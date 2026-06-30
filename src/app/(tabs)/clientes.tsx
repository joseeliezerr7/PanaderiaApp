import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Chip, FAB, IconButton, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { BarraEstado } from '../../components/BarraEstado';
import { EstadoVacio } from '../../components/EstadoVacio';
import { hoyISO } from '../../db/database';
import type { Ruta } from '../../db/types';
import { esAdmin, useUsuarioActivo } from '../../hooks/useUsuarioActivo';
import { sincronizar, sincronizarEnFondo } from '../../sync/sync';
import { tema } from '../../tema';

interface FilaCliente {
  id: string;
  nombre: string;
  negocio: string | null;
  ruta: string | null;
  orden_visita: number | null;
  venta_hoy: number; // 1 si tiene pedido hoy
  visitado_hoy: number; // 1 si se marcó visita manual hoy
}

export default function Clientes() {
  const db = useSQLiteContext();
  const router = useRouter();
  const usuario = useUsuarioActivo();
  const [filas, setFilas] = useState<FilaCliente[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [rutaActiva, setRutaActiva] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [ordenando, setOrdenando] = useState(false);
  const [ordenLocal, setOrdenLocal] = useState<FilaCliente[]>([]);
  const [refrescando, setRefrescando] = useState(false);

  const refrescar = async () => {
    setRefrescando(true);
    await sincronizar(db);
    await cargar();
    setRefrescando(false);
  };

  const cargar = useCallback(async () => {
    const soloMios = usuario && !esAdmin(usuario);
    setRutas(await db.getAllAsync<Ruta>(
      `SELECT * FROM rutas WHERE activa = 1 AND _deleted = 0 ORDER BY nombre`,
    ));
    setFilas(await db.getAllAsync<FilaCliente>(
      `SELECT c.id, c.nombre, c.negocio, c.orden_visita, r.nombre AS ruta,
              EXISTS(SELECT 1 FROM pedidos p
                      WHERE p.cliente_id = c.id AND substr(p.fecha,1,10) = ?
                        AND p._deleted = 0 AND p.estado != 'cancelado') AS venta_hoy,
              EXISTS(SELECT 1 FROM visitas v
                      WHERE v.cliente_id = c.id AND v.fecha = ?) AS visitado_hoy
         FROM clientes c LEFT JOIN rutas r ON r.id = c.ruta_id
        WHERE c.activo = 1 AND c._deleted = 0
          ${soloMios ? 'AND c.usuario_id = ?' : ''}
        ORDER BY r.nombre IS NULL, r.nombre, c.orden_visita IS NULL, c.orden_visita`,
      soloMios ? [hoyISO(), hoyISO(), usuario.id] : [hoyISO(), hoyISO()],
    ));
  }, [db, usuario]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const visibles = (ordenando ? ordenLocal : filas).filter((f) => {
    if (rutaActiva && f.ruta !== rutaActiva) return false;
    const q = busqueda.toLowerCase();
    return !q || f.nombre.toLowerCase().includes(q) || (f.negocio ?? '').toLowerCase().includes(q);
  });

  const marcarVisita = async (f: FilaCliente) => {
    if (f.visitado_hoy) {
      await db.runAsync('DELETE FROM visitas WHERE cliente_id = ? AND fecha = ?', [f.id, hoyISO()]);
    } else {
      await db.runAsync('INSERT OR IGNORE INTO visitas (cliente_id, fecha) VALUES (?, ?)', [f.id, hoyISO()]);
    }
    await cargar();
  };

  const empezarOrden = () => {
    setOrdenLocal(filas.filter((f) => f.ruta === rutaActiva));
    setOrdenando(true);
  };

  const mover = (idx: number, delta: number) => {
    setOrdenLocal((prev) => {
      const j = idx + delta;
      if (j < 0 || j >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[j]] = [copia[j], copia[idx]];
      return copia;
    });
  };

  const guardarOrden = async () => {
    await db.withTransactionAsync(async () => {
      for (let i = 0; i < ordenLocal.length; i++) {
        await db.runAsync(
          'UPDATE clientes SET orden_visita = ?, _dirty = 1 WHERE id = ?',
          [i + 1, ordenLocal[i].id],
        );
      }
    });
    setOrdenando(false);
    sincronizarEnFondo(db);
    await cargar();
  };

  return (
    <View style={estilos.pantalla}>
      <BarraEstado />
      <Searchbar
        placeholder="Buscar cliente o negocio"
        value={busqueda}
        onChangeText={setBusqueda}
        style={estilos.buscador}
      />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={rutas}
        keyExtractor={(r) => r.id}
        style={estilos.tiraRutas}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <Chip
            selected={rutaActiva === item.nombre}
            onPress={() => {
              setOrdenando(false);
              setRutaActiva(rutaActiva === item.nombre ? null : item.nombre);
            }}
            compact
          >
            {item.nombre}
          </Chip>
        )}
      />

      {rutaActiva && !ordenando && (
        <Button
          mode="text"
          icon="swap-vertical"
          onPress={empezarOrden}
          style={estilos.botonOrden}
          compact
        >
          Ordenar visitas de {rutaActiva}
        </Button>
      )}
      {ordenando && (
        <View style={estilos.barraOrden}>
          <Text variant="bodySmall" style={{ flex: 1, color: tema.colors.onSurfaceVariant }}>
            Usa las flechas y guarda
          </Text>
          <Button compact onPress={() => setOrdenando(false)}>Cancelar</Button>
          <Button compact mode="contained" onPress={guardarOrden}>Guardar orden</Button>
        </View>
      )}

      <FlatList
        data={visibles}
        keyExtractor={(f) => f.id}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        ListEmptyComponent={
          <EstadoVacio
            icono="storefront-outline"
            titulo={busqueda || rutaActiva ? 'Sin resultados' : 'Aún no hay clientes'}
            detalle={
              busqueda || rutaActiva
                ? 'Prueba con otra búsqueda o ruta.'
                : 'Desliza hacia abajo para sincronizar, o agrega tu primer cliente.'
            }
            accion={busqueda || rutaActiva ? undefined : { etiqueta: 'Nuevo cliente', icono: 'account-plus', onPress: () => router.push('/cliente/nuevo') }}
          />
        }
        renderItem={({ item, index }) => (
          <TouchableRipple
            disabled={ordenando}
            onPress={() => router.push({ pathname: '/cliente/[id]', params: { id: item.id } })}
          >
            <View style={estilos.fila}>
              {ordenando ? (
                <View style={estilos.flechas}>
                  <IconButton icon="arrow-up" size={18} mode="contained-tonal"
                    disabled={index === 0} onPress={() => mover(index, -1)} />
                  <IconButton icon="arrow-down" size={18} mode="contained-tonal"
                    disabled={index === visibles.length - 1} onPress={() => mover(index, 1)} />
                </View>
              ) : (
                <IconButton
                  icon={item.venta_hoy ? 'check-circle' : item.visitado_hoy ? 'storefront-check' : 'circle-outline'}
                  iconColor={item.venta_hoy ? '#2E7D32' : item.visitado_hoy ? tema.colors.secondary : tema.colors.outline}
                  size={24}
                  disabled={!!item.venta_hoy}
                  onPress={() => void marcarVisita(item)}
                  accessibilityLabel="Marcar visitado"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" numberOfLines={1}>{item.nombre}</Text>
                <Text variant="bodySmall" style={estilos.secundario} numberOfLines={1}>
                  {[item.negocio, item.ruta].filter(Boolean).join('  ·  ')}
                  {item.venta_hoy ? '  ·  venta hoy ✓' : item.visitado_hoy ? '  ·  visitado, sin venta' : ''}
                </Text>
              </View>
              {item.orden_visita != null && !ordenando && (
                <Text style={estilos.orden}>#{item.orden_visita}</Text>
              )}
            </View>
          </TouchableRipple>
        )}
      />
      {!ordenando && (
        <FAB
          icon="account-plus"
          label="Cliente"
          color="white"
          style={estilos.fab}
          onPress={() => router.push('/cliente/nuevo')}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  buscador: { marginHorizontal: 16, marginTop: 12, backgroundColor: tema.colors.surfaceVariant },
  tiraRutas: { flexGrow: 0, marginVertical: 10 },
  botonOrden: { alignSelf: 'flex-start', marginLeft: 8 },
  barraOrden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  vacio: { textAlign: 'center', marginTop: 48, color: tema.colors.onSurfaceVariant },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    paddingLeft: 4,
    paddingVertical: 6,
    gap: 4,
  },
  flechas: { flexDirection: 'row' },
  secundario: { color: tema.colors.onSurfaceVariant },
  orden: { color: tema.colors.outline, fontWeight: '600' },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: tema.colors.primary },
});
