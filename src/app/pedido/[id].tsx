import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Chip, Dialog, Divider, IconButton, Menu, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { hoyISO } from '../../db/database';
import type { Cliente, Pedido, Producto } from '../../db/types';
import { esAdmin, useUsuarioActivo } from '../../hooks/useUsuarioActivo';
import { getVendedorId } from '../../store/ajustes';
import { sincronizarEnFondo } from '../../sync/sync';
import { colorEstado, formatoFecha, formatoLempira, tema } from '../../tema';

interface LineaEdit {
  lineaId: string | null;
  producto: Producto;
  cantidad: number;
  devolucion: number;
  precio: number;
}

export default function PantallaPedido() {
  const db = useSQLiteContext();
  const router = useRouter();
  const usuario = useUsuarioActivo();
  const { id, clienteId } = useLocalSearchParams<{ id: string; clienteId?: string }>();
  const esNuevo = id === 'nuevo';

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [estado, setEstado] = useState<Pedido['estado']>('enviado');
  const [lineas, setLineas] = useState<LineaEdit[]>([]);
  const [nota, setNota] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [devolucionDe, setDevolucionDe] = useState<number | null>(null); // índice de línea en diálogo
  const [cantidadDe, setCantidadDe] = useState<number | null>(null); // índice para escribir cantidad
  const [cantidadTexto, setCantidadTexto] = useState('');
  const [notaVisible, setNotaVisible] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sucio, setSucio] = useState(false); // hay cambios sin guardar
  const [guardado, setGuardado] = useState(false);
  const [edicionForzada, setEdicionForzada] = useState(false); // admin desbloqueó un pedido cerrado
  const navigation = useNavigation();

  // Un pedido entregado o cancelado queda cerrado: no se puede vender de más
  // ni inflar devoluciones después del hecho. Solo un admin puede desbloquearlo.
  const cerrado = estado === 'entregado' || estado === 'cancelado';
  const editable = !cerrado || edicionForzada;

  const cargar = useCallback(async () => {
    const productos = await db.getAllAsync<Producto>(
      `SELECT p.*, (SELECT precio FROM precios_producto pp
                     WHERE pp.producto_id = p.id AND pp._deleted = 0
                       AND pp.vigente_desde <= ?
                     ORDER BY pp.vigente_desde DESC LIMIT 1) AS precio
         FROM productos p
        WHERE p.activo = 1 AND p._deleted = 0
        ORDER BY p.orden`,
      [hoyISO()],
    );

    let ped: Pedido | null = null;
    const existentes: Record<string, any> = {};
    let idCliente = clienteId ?? null;

    if (!esNuevo) {
      ped = await db.getFirstAsync<Pedido>('SELECT * FROM pedidos WHERE id = ?', [id]);
      if (ped) {
        idCliente = ped.cliente_id;
        setEstado(ped.estado);
        setNota(ped.nota ?? '');
        for (const f of await db.getAllAsync<any>(
          'SELECT * FROM pedido_lineas WHERE pedido_id = ? AND _deleted = 0', [id],
        )) existentes[f.producto_id] = f;
      }
    }
    setPedido(ped);

    if (idCliente) {
      setCliente(await db.getFirstAsync<Cliente>('SELECT * FROM clientes WHERE id = ?', [idCliente]));
    }

    setLineas(productos.map((p) => {
      const ex = existentes[p.id];
      return {
        lineaId: ex?.id ?? null,
        producto: p,
        cantidad: ex?.cantidad ?? 0,
        devolucion: ex?.devolucion_anterior ?? 0,
        precio: ex?.precio_unitario ?? p.precio ?? 0,
      };
    }));
  }, [db, id, clienteId, esNuevo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const total = useMemo(
    () => lineas.reduce((s, l) => s + (l.cantidad - l.devolucion) * l.precio, 0),
    [lineas],
  );
  const unidades = useMemo(() => lineas.reduce((s, l) => s + l.cantidad, 0), [lineas]);
  const devueltas = useMemo(() => lineas.reduce((s, l) => s + l.devolucion, 0), [lineas]);

  const ajustar = (idx: number, campo: 'cantidad' | 'devolucion', delta: number) => {
    if (!editable) return;
    if (delta > 0) void Haptics.selectionAsync();
    setSucio(true);
    setLineas((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      if (campo === 'devolucion') {
        // no se puede devolver más de lo que se llevó en esta misma línea
        return { ...l, devolucion: Math.max(0, Math.min(l.cantidad, l.devolucion + delta)) };
      }
      const cantidad = Math.max(0, l.cantidad + delta);
      return { ...l, cantidad, devolucion: Math.min(l.devolucion, cantidad) };
    }));
  };

  const fijarCantidad = (idx: number, valor: number) => {
    if (!editable) return;
    setSucio(true);
    setLineas((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const cantidad = Math.max(0, valor);
      return { ...l, cantidad, devolucion: Math.min(l.devolucion, cantidad) };
    }));
  };

  // Aviso de cambios sin guardar al salir.
  useEffect(() => {
    const sub = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (!sucio || guardado) return;
      e.preventDefault();
      Alert.alert('¿Salir sin guardar?', 'Tienes cambios sin guardar en este pedido.', [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return sub;
  }, [navigation, sucio, guardado]);

  /** Guarda el pedido; opcionalmente con un estado final y navegación al ticket. */
  const guardar = async (opciones?: { nuevoEstado?: Pedido['estado']; alTerminar?: 'atras' | 'ticket' }) => {
    if (!cliente) return false;
    const estadoFinal = opciones?.nuevoEstado ?? estado;
    if (unidades === 0 && devueltas === 0 && estadoFinal !== 'cancelado') {
      Alert.alert('Pedido vacío', 'Agrega al menos un producto o una devolución.');
      return false;
    }
    setGuardando(true);
    try {
      const pedidoId = pedido?.id ?? Crypto.randomUUID();
      const vendedor = pedido?.usuario_id ?? (await getVendedorId());

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT OR REPLACE INTO pedidos (id, cliente_id, usuario_id, fecha, estado, nota, _dirty, _deleted)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
          [pedidoId, cliente.id, vendedor, pedido?.fecha?.slice(0, 10) ?? hoyISO(), estadoFinal, nota.trim() || null],
        );
        for (const l of lineas) {
          if (l.cantidad > 0 || l.devolucion > 0) {
            await db.runAsync(
              `INSERT OR REPLACE INTO pedido_lineas
                 (id, pedido_id, producto_id, cantidad, precio_unitario, devolucion_anterior, _dirty, _deleted)
               VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
              [l.lineaId ?? Crypto.randomUUID(), pedidoId, l.producto.id, l.cantidad, l.precio, l.devolucion],
            );
          } else if (l.lineaId) {
            await db.runAsync('UPDATE pedido_lineas SET _deleted = 1 WHERE id = ?', [l.lineaId]);
          }
        }
      });

      setEstado(estadoFinal);
      setGuardado(true);
      setSucio(false);
      if (estadoFinal === 'entregado') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sincronizarEnFondo(db);
      if (opciones?.alTerminar === 'ticket') {
        router.replace({ pathname: '/ticket/[id]', params: { id: pedidoId } });
      } else {
        setAviso('Pedido guardado ✓');
        setTimeout(() => router.back(), 700);
      }
      return true;
    } catch (e: any) {
      Alert.alert('No se pudo guardar', String(e?.message ?? e));
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const entregar = () =>
    Alert.alert('Entregar pedido', 'Se marcará como entregado y se generará el ticket.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Entregar ✓', onPress: () => void guardar({ nuevoEstado: 'entregado', alTerminar: 'ticket' }) },
    ]);

  const cancelarPedido = () =>
    Alert.alert('Cancelar pedido', '¿Seguro que quieres cancelar este pedido?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => void guardar({ nuevoEstado: 'cancelado', alTerminar: 'atras' }),
      },
    ]);

  const lineaDialogo = devolucionDe != null ? lineas[devolucionDe] : null;

  return (
    <View style={estilos.pantalla}>
      <Stack.Screen options={{ title: esNuevo ? 'Nuevo pedido' : 'Pedido' }} />

      <View style={estilos.cabecera}>
        <TouchableOpacity
          style={estilos.cabeceraCliente}
          disabled={!cliente}
          onPress={() => cliente && router.push({ pathname: '/cliente/[id]', params: { id: cliente.id } })}
        >
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" numberOfLines={1}>{cliente?.nombre ?? '…'}</Text>
            <Text variant="bodySmall" style={estilos.secundario}>
              {pedido ? formatoFecha(pedido.fecha) : formatoFecha(hoyISO())}
              {cliente?.negocio ? `  ·  ${cliente.negocio}` : ''}
            </Text>
          </View>
          {!!cliente && (
            <MaterialCommunityIcons name="history" size={20} color={tema.colors.primary} />
          )}
        </TouchableOpacity>
        <Chip
          compact
          icon={cerrado && !edicionForzada ? 'lock' : undefined}
          style={{ backgroundColor: colorEstado[estado] }}
          textStyle={estilos.chipEstado}
        >
          {estado}
        </Chip>
        <Menu
          visible={menuAbierto}
          onDismiss={() => setMenuAbierto(false)}
          anchor={<IconButton icon="dots-vertical" onPress={() => setMenuAbierto(true)} />}
        >
          {estado === 'entregado' && !esNuevo && (
            <Menu.Item
              leadingIcon="receipt"
              title="Ver ticket"
              onPress={() => {
                setMenuAbierto(false);
                router.push({ pathname: '/ticket/[id]', params: { id: String(id) } });
              }}
            />
          )}
          {cerrado && !edicionForzada && esAdmin(usuario) && (
            <Menu.Item
              leadingIcon="lock-open-variant"
              title="Editar pedido cerrado"
              onPress={() => {
                setMenuAbierto(false);
                Alert.alert(
                  'Editar pedido cerrado',
                  'Este pedido ya está ' + estado + '. Solo un administrador puede corregirlo. ¿Continuar?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Editar', onPress: () => setEdicionForzada(true) },
                  ],
                );
              }}
            />
          )}
          {estado !== 'cancelado' && (
            <Menu.Item
              leadingIcon="close-circle"
              title="Cancelar pedido"
              onPress={() => {
                setMenuAbierto(false);
                cancelarPedido();
              }}
            />
          )}
        </Menu>
      </View>
      {cerrado && edicionForzada && (
        <View style={estilos.bannerEdicion}>
          <MaterialCommunityIcons name="alert" size={16} color="#7A4B00" />
          <Text variant="bodySmall" style={estilos.bannerTexto}>
            Editando un pedido {estado} — los cambios afectan algo ya cerrado.
          </Text>
        </View>
      )}
      <Divider />

      <FlatList
        data={lineas}
        keyExtractor={(l) => l.producto.id}
        contentContainerStyle={{ paddingBottom: 130 }}
        renderItem={({ item, index }) => (
          <View style={[estilos.filaProducto, item.cantidad > 0 && estilos.filaActiva]}>
            <View style={estilos.filaSuperior}>
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall">{item.producto.nombre}</Text>
                <Text variant="bodySmall" style={estilos.secundario}>
                  {formatoLempira(item.precio)}
                </Text>
              </View>
              {editable ? (
                <View style={estilos.controles}>
                  <IconButton
                    icon="minus"
                    size={20}
                    mode="contained-tonal"
                    disabled={item.cantidad === 0}
                    onPress={() => ajustar(index, 'cantidad', -1)}
                  />
                  <TouchableOpacity
                    onPress={() => { setCantidadDe(index); setCantidadTexto(String(item.cantidad)); }}
                    accessibilityLabel="Escribir cantidad"
                  >
                    <Text style={estilos.cantidad}>{item.cantidad}</Text>
                  </TouchableOpacity>
                  <IconButton
                    icon="plus"
                    size={20}
                    mode="contained"
                    onPress={() => ajustar(index, 'cantidad', 1)}
                  />
                </View>
              ) : (
                <Text style={estilos.cantidadFija}>{item.cantidad}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                estilos.botonDevolucion,
                item.devolucion > 0 && estilos.botonDevolucionActivo,
                !editable && estilos.deshabilitado,
              ]}
              disabled={!editable}
              onPress={() => setDevolucionDe(index)}
              accessibilityLabel="Registrar devolución de este producto"
            >
              <MaterialCommunityIcons
                name="backup-restore"
                size={16}
                color={item.devolucion > 0 ? tema.colors.error : tema.colors.primary}
              />
              <Text style={[estilos.devolucionTexto, item.devolucion === 0 && { color: tema.colors.primary }]}>
                {item.devolucion > 0
                  ? `${item.devolucion} devuelto${item.devolucion > 1 ? 's' : ''}`
                  : editable ? 'Registrar devolución' : 'Sin devolución'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={[estilos.notaBtn, !editable && estilos.deshabilitado]}
            disabled={!editable}
            onPress={() => setNotaVisible(true)}
          >
            <MaterialCommunityIcons name="note-edit-outline" size={20} color={tema.colors.primary} />
            <Text style={{ color: tema.colors.primary, flex: 1 }} numberOfLines={1}>
              {nota.trim() ? `Nota: ${nota}` : editable ? 'Agregar nota al pedido' : 'Sin nota'}
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={estilos.pie}>
        <View>
          <Text variant="bodySmall" style={{ color: '#FFE6C7' }}>
            {unidades} unid.{devueltas > 0 ? `  ·  ${devueltas} devueltas` : ''}
          </Text>
          <Text variant="headlineSmall" style={estilos.total}>
            {formatoLempira(total)}
          </Text>
        </View>
        <View style={estilos.botonesPie}>
          {estado === 'entregado' && (
            <Button
              mode="outlined"
              textColor="white"
              disabled={guardando || esNuevo && !pedido}
              onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: String(pedido?.id ?? id) } })}
              icon={() => <MaterialCommunityIcons name="receipt" size={18} color="white" />}
            >
              Ticket
            </Button>
          )}
          {!cerrado && (
            <Button
              mode="outlined"
              textColor="white"
              disabled={guardando || !cliente}
              onPress={entregar}
              icon={() => <MaterialCommunityIcons name="check-circle" size={18} color="white" />}
            >
              Entregar
            </Button>
          )}
          {editable ? (
            <Button
              mode="contained"
              buttonColor="white"
              textColor={tema.colors.primary}
              loading={guardando}
              disabled={guardando || !cliente}
              onPress={() => void guardar()}
              icon={() => <MaterialCommunityIcons name="content-save" size={18} color={tema.colors.primary} />}
            >
              {cerrado ? 'Guardar cambios' : 'Guardar'}
            </Button>
          ) : estado === 'cancelado' && (
            <View style={estilos.cerradoTexto}>
              <MaterialCommunityIcons name="close-circle" size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '700' }}>Pedido cancelado</Text>
            </View>
          )}
        </View>
      </View>

      <Portal>
        <Dialog visible={devolucionDe != null} onDismiss={() => setDevolucionDe(null)}>
          <Dialog.Title style={{ fontSize: 18 }}>
            Devolución · {lineaDialogo?.producto.nombre}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={[estilos.secundario, { marginBottom: 12 }]}>
              Pan que el cliente devuelve de este pedido. Se descuenta del total. Máximo: la cantidad
              llevada ({lineaDialogo?.cantidad ?? 0}).
            </Text>
            <View style={estilos.controlesDialogo}>
              <IconButton
                icon="minus"
                mode="contained-tonal"
                size={26}
                disabled={!lineaDialogo || lineaDialogo.devolucion === 0}
                onPress={() => devolucionDe != null && ajustar(devolucionDe, 'devolucion', -1)}
              />
              <Text style={estilos.cantidadDialogo}>{lineaDialogo?.devolucion ?? 0}</Text>
              <IconButton
                icon="plus"
                mode="contained"
                size={26}
                disabled={!lineaDialogo || lineaDialogo.devolucion >= lineaDialogo.cantidad}
                onPress={() => devolucionDe != null && ajustar(devolucionDe, 'devolucion', 1)}
              />
            </View>
            {!!lineaDialogo && lineaDialogo.cantidad > 0 && lineaDialogo.devolucion >= lineaDialogo.cantidad && (
              <Text variant="bodySmall" style={estilos.maxAlcanzado}>
                Máximo alcanzado para este producto.
              </Text>
            )}
            {!!lineaDialogo && lineaDialogo.cantidad === 0 && (
              <Text variant="bodySmall" style={estilos.maxAlcanzado}>
                Agrega cantidad de este producto antes de registrar su devolución.
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDevolucionDe(null)}>Listo</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={cantidadDe != null} onDismiss={() => setCantidadDe(null)}>
          <Dialog.Title style={{ fontSize: 18 }}>
            {cantidadDe != null ? lineas[cantidadDe]?.producto.nombre : ''}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Cantidad"
              value={cantidadTexto}
              onChangeText={(t) => setCantidadTexto(t.replace(/[^0-9]/g, ''))}
              mode="outlined"
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCantidadDe(null)}>Cancelar</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (cantidadDe != null) fijarCantidad(cantidadDe, parseInt(cantidadTexto || '0', 10));
                setCantidadDe(null);
              }}
            >
              Listo
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={notaVisible} onDismiss={() => setNotaVisible(false)}>
          <Dialog.Title style={{ fontSize: 18 }}>Nota del pedido</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Ej. dejar con la vecina, pagar el viernes…"
              value={nota}
              onChangeText={(t) => { setNota(t); setSucio(true); }}
              mode="outlined"
              multiline
              numberOfLines={3}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNotaVisible(false)}>Listo</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!aviso} onDismiss={() => setAviso('')} duration={1500}>
        {aviso}
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cabeceraCliente: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  secundario: { color: tema.colors.onSurfaceVariant },
  chipEstado: { color: 'white', fontWeight: '700' },
  devolucionTexto: { fontSize: 12, fontWeight: '700', color: tema.colors.error },
  filaProducto: {
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 6,
    gap: 4,
  },
  filaSuperior: { flexDirection: 'row', alignItems: 'center' },
  filaActiva: { backgroundColor: tema.colors.primaryContainer + '55' },
  controles: { flexDirection: 'row', alignItems: 'center' },
  botonDevolucion: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: tema.colors.primaryContainer + '55',
  },
  botonDevolucionActivo: { backgroundColor: '#FBE2E2' },
  cantidad: { minWidth: 32, textAlign: 'center', fontSize: 18, fontWeight: '700', paddingVertical: 6 },
  cantidadFija: { fontSize: 18, fontWeight: '700', color: tema.colors.onSurfaceVariant, paddingRight: 4 },
  deshabilitado: { opacity: 0.45 },
  bannerEdicion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFE9B3',
  },
  bannerTexto: { color: '#7A4B00', flex: 1 },
  maxAlcanzado: { textAlign: 'center', color: tema.colors.error, marginTop: 8 },
  cerradoTexto: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.colors.primaryContainer,
    backgroundColor: tema.colors.primaryContainer + '40',
  },
  controlesDialogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  cantidadDialogo: { fontSize: 32, fontWeight: '800', minWidth: 56, textAlign: 'center' },
  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tema.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  total: { color: 'white', fontWeight: '800' },
  botonesPie: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
