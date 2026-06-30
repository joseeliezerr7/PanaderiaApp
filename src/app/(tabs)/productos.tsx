import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import { EstadoVacio } from '../../components/EstadoVacio';
import { hoyISO } from '../../db/database';
import type { Producto } from '../../db/types';
import { sincronizar } from '../../sync/sync';
import { formatoLempira, tema } from '../../tema';

interface FilaProducto extends Producto {
  vendidas_semana: number | null;
}

export default function Productos() {
  const db = useSQLiteContext();
  const [filas, setFilas] = useState<FilaProducto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setFilas(await db.getAllAsync<FilaProducto>(
      `SELECT p.*,
              (SELECT precio FROM precios_producto pp
                WHERE pp.producto_id = p.id AND pp._deleted = 0 AND pp.vigente_desde <= ?
                ORDER BY pp.vigente_desde DESC LIMIT 1) AS precio,
              (SELECT SUM(l.cantidad) FROM pedido_lineas l
                 JOIN pedidos pe ON pe.id = l.pedido_id AND pe._deleted = 0
                WHERE l.producto_id = p.id AND l._deleted = 0
                  AND substr(pe.fecha, 1, 10) >= date('now', '-7 days')) AS vendidas_semana
         FROM productos p
        WHERE p.activo = 1 AND p._deleted = 0
        ORDER BY p.orden`,
      [hoyISO()],
    ));
  }, [db]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await sincronizar(db);
    await cargar();
    setRefrescando(false);
  };

  const q = busqueda.toLowerCase();
  const visibles = q ? filas.filter((p) => p.nombre.toLowerCase().includes(q)) : filas;

  return (
    <FlatList
      data={visibles}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      ListHeaderComponent={
        <Searchbar
          placeholder="Buscar producto"
          value={busqueda}
          onChangeText={setBusqueda}
          style={estilos.buscador}
        />
      }
      ListEmptyComponent={
        <EstadoVacio
          icono="bread-slice-outline"
          titulo={q ? 'Sin resultados' : 'Aún no hay productos'}
          detalle={q ? 'Prueba con otro nombre.' : 'Desliza hacia abajo para sincronizar el catálogo.'}
        />
      }
      renderItem={({ item }) => (
        <View style={estilos.fila}>
          <View style={estilos.icono}>
            <MaterialCommunityIcons name="bread-slice" size={22} color={tema.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall">{item.nombre}</Text>
            <Text variant="bodySmall" style={estilos.secundario}>
              {item.vendidas_semana
                ? `${item.vendidas_semana} vendidas en los últimos 7 días`
                : 'sin ventas esta semana'}
            </Text>
          </View>
          <Text style={estilos.precio}>{formatoLempira(item.precio ?? 0)}</Text>
        </View>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  buscador: { marginHorizontal: 16, marginVertical: 10, backgroundColor: tema.colors.surfaceVariant },
  vacio: { textAlign: 'center', marginTop: 48, color: tema.colors.onSurfaceVariant },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secundario: { color: tema.colors.onSurfaceVariant },
  precio: { fontWeight: '700', fontSize: 16 },
});
