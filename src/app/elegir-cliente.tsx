import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, IconButton, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { EstadoVacio } from '../components/EstadoVacio';
import { NOMBRES_DIA, diaNumHoy, hoyISO } from '../db/database';
import { esAdmin, useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { sincronizarEnFondo } from '../sync/sync';
import { tema } from '../tema';

interface Fila {
  id: string;
  nombre: string;
  negocio: string | null;
  ruta: string | null;
  orden_visita: number | null;
  pedido_id: string | null;
  pedido_estado: string | null;
  total: number | null;
  visitado_hoy: number;
}

/** Pantalla modal: elegir cliente para un pedido nuevo. */
export default function ElegirCliente() {
  const db = useSQLiteContext();
  const router = useRouter();
  const usuario = useUsuarioActivo();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [soloHoy, setSoloHoy] = useState(true);
  const [ordenando, setOrdenando] = useState(false);
  const [ordenLocal, setOrdenLocal] = useState<Fila[]>([]);

  const cargar = useCallback(async () => {
    const soloMios = usuario && !esAdmin(usuario);
    const filtroDia = soloHoy
      ? `AND EXISTS(SELECT 1 FROM cliente_dias_visita d
                     WHERE d.cliente_id = c.id AND d.dia_num = ? AND d._deleted = 0)`
      : '';
    const filtroVendedor = soloMios ? 'AND c.usuario_id = ?' : '';
    const args = [hoyISO(), hoyISO()];
    if (soloHoy) args.push(String(diaNumHoy()));
    if (soloMios) args.push(usuario.id);

    setFilas(await db.getAllAsync<Fila>(
      `SELECT c.id, c.nombre, c.negocio, c.orden_visita, r.nombre AS ruta,
              p.id AS pedido_id, p.estado AS pedido_estado,
              (SELECT SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario)
                 FROM pedido_lineas l WHERE l.pedido_id = p.id AND l._deleted = 0) AS total,
              EXISTS(SELECT 1 FROM visitas v
                      WHERE v.cliente_id = c.id AND v.fecha = ?) AS visitado_hoy
         FROM clientes c
         LEFT JOIN rutas r ON r.id = c.ruta_id
         LEFT JOIN pedidos p
           ON p.cliente_id = c.id AND substr(p.fecha,1,10) = ? AND p._deleted = 0
        WHERE c.activo = 1 AND c._deleted = 0 ${filtroDia} ${filtroVendedor}
        ORDER BY c.orden_visita IS NULL, c.orden_visita, c.nombre`,
      args,
    ));
  }, [db, usuario, soloHoy]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = (ordenando ? ordenLocal : filas).filter((f) => {
    const q = busqueda.toLowerCase();
    return !q || f.nombre.toLowerCase().includes(q) || (f.negocio ?? '').toLowerCase().includes(q);
  });

  const marcarVisita = async (f: Fila) => {
    if (f.visitado_hoy) {
      await db.runAsync('DELETE FROM visitas WHERE cliente_id = ? AND fecha = ?', [f.id, hoyISO()]);
    } else {
      await db.runAsync('INSERT OR IGNORE INTO visitas (cliente_id, fecha) VALUES (?, ?)', [f.id, hoyISO()]);
    }
    await cargar();
  };

  const abrir = (f: Fila) => {
    if (f.pedido_id) {
      router.replace({ pathname: '/pedido/[id]', params: { id: f.pedido_id } });
    } else {
      router.replace({ pathname: '/pedido/[id]', params: { id: 'nuevo', clienteId: f.id } });
    }
  };

  const empezarOrden = () => {
    setOrdenLocal(filas);
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
      <Stack.Screen options={{ title: '¿Para qué cliente?', presentation: 'modal' }} />
      <Searchbar
        placeholder="Buscar cliente o negocio"
        value={busqueda}
        onChangeText={setBusqueda}
        style={estilos.buscador}
        autoFocus
      />

      <View style={estilos.tira}>
        <Button
          mode={soloHoy ? 'contained-tonal' : 'outlined'}
          compact
          icon="calendar-today"
          onPress={() => { setOrdenando(false); setSoloHoy(true); }}
        >
          Hoy ({NOMBRES_DIA[diaNumHoy()]})
        </Button>
        <Button
          mode={!soloHoy ? 'contained-tonal' : 'outlined'}
          compact
          icon="account-group"
          onPress={() => { setOrdenando(false); setSoloHoy(false); }}
        >
          Todos los clientes
        </Button>
      </View>

      {!ordenando && filas.length > 1 && (
        <Button mode="text" icon="swap-vertical" onPress={empezarOrden} style={estilos.botonOrden} compact>
          Ordenar visitas
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
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EstadoVacio
            icono="calendar-remove"
            titulo={soloHoy ? `Nadie programado para ${NOMBRES_DIA[diaNumHoy()]}` : 'Sin clientes'}
            detalle={soloHoy ? 'Toca "Todos los clientes" para buscar a alguien fuera de ruta.' : 'Sincroniza desde Ajustes.'}
          />
        }
        renderItem={({ item, index }) => (
          <TouchableRipple disabled={ordenando} onPress={() => abrir(item)}>
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
                  icon={item.pedido_id ? 'check-circle' : item.visitado_hoy ? 'storefront-check' : 'circle-outline'}
                  iconColor={item.pedido_id ? '#2E7D32' : item.visitado_hoy ? tema.colors.secondary : tema.colors.outline}
                  size={24}
                  disabled={!!item.pedido_id}
                  onPress={() => void marcarVisita(item)}
                  accessibilityLabel="Marcar visitado"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" numberOfLines={1}>{item.nombre}</Text>
                <Text variant="bodySmall" style={estilos.secundario} numberOfLines={1}>
                  {[item.negocio, item.ruta].filter(Boolean).join('  ·  ')}
                  {item.pedido_id ? '  ·  ya tiene pedido hoy' : item.visitado_hoy ? '  ·  visitado, sin venta' : ''}
                </Text>
              </View>
              {item.orden_visita != null && !ordenando && (
                <Text style={estilos.orden}>#{item.orden_visita}</Text>
              )}
              {!ordenando && (
                <>
                  <IconButton
                    icon="history"
                    size={20}
                    iconColor={tema.colors.primary}
                    onPress={() => router.push({ pathname: '/cliente/[id]', params: { id: item.id } })}
                    accessibilityLabel="Ver historial del cliente"
                  />
                  <MaterialCommunityIcons name="chevron-right" size={22} color={tema.colors.outline} />
                </>
              )}
            </View>
          </TouchableRipple>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  buscador: { margin: 16, marginBottom: 8, backgroundColor: tema.colors.surfaceVariant },
  tira: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  botonOrden: { alignSelf: 'flex-start', marginLeft: 8 },
  barraOrden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
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
});
