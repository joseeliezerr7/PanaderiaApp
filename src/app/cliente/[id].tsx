import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Linking, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, SegmentedButtons, Text, TouchableRipple } from 'react-native-paper';
import { NOMBRES_DIA } from '../../db/database';
import type { Cliente } from '../../db/types';
import { colorEstado, formatoFecha, formatoLempira, tema } from '../../tema';

interface FilaPedido {
  id: string;
  fecha: string;
  estado: string;
  total: number | null;
}

interface FilaDevolucion {
  id: string;
  pedido_id: string;
  fecha: string;
  producto: string;
  devueltas: number;
  monto: number;
}

export default function FichaCliente() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cliente, setCliente] = useState<(Cliente & { ruta: string | null }) | null>(null);
  const [dias, setDias] = useState<number[]>([]);
  const [pedidos, setPedidos] = useState<FilaPedido[]>([]);
  const [devoluciones, setDevoluciones] = useState<FilaDevolucion[]>([]);
  const [vista, setVista] = useState<'pedidos' | 'devoluciones'>('pedidos');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setCliente(await db.getFirstAsync(
          `SELECT c.*, r.nombre AS ruta FROM clientes c
            LEFT JOIN rutas r ON r.id = c.ruta_id WHERE c.id = ?`, [id],
        ));
        setDias((await db.getAllAsync<{ dia_num: number }>(
          `SELECT dia_num FROM cliente_dias_visita
            WHERE cliente_id = ? AND _deleted = 0 ORDER BY dia_num`, [id],
        )).map((d) => d.dia_num));
        setPedidos(await db.getAllAsync<FilaPedido>(
          `SELECT p.id, p.fecha, p.estado,
                  (SELECT SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario)
                     FROM pedido_lineas l WHERE l.pedido_id = p.id AND l._deleted = 0) AS total
             FROM pedidos p
            WHERE p.cliente_id = ? AND p._deleted = 0
            ORDER BY p.fecha DESC LIMIT 50`, [id],
        ));
        setDevoluciones(await db.getAllAsync<FilaDevolucion>(
          `SELECT l.id, l.pedido_id, p.fecha, pr.nombre AS producto,
                  l.devolucion_anterior AS devueltas,
                  l.devolucion_anterior * l.precio_unitario AS monto
             FROM pedido_lineas l
             JOIN pedidos p ON p.id = l.pedido_id AND p._deleted = 0
             JOIN productos pr ON pr.id = l.producto_id
            WHERE p.cliente_id = ? AND l.devolucion_anterior > 0 AND l._deleted = 0
            ORDER BY p.fecha DESC LIMIT 100`, [id],
        ));
      })();
    }, [db, id]),
  );

  if (!cliente) return null;

  return (
    <View style={estilos.pantalla}>
      <Stack.Screen options={{ title: cliente.nombre }} />
      <Card style={estilos.tarjeta} mode="contained">
        <Card.Content style={{ gap: 6 }}>
          {!!cliente.negocio && <Text variant="titleMedium">{cliente.negocio}</Text>}
          {!!cliente.direccion && (
            <Text variant="bodyMedium" style={estilos.secundario}>{cliente.direccion}</Text>
          )}
          <View style={estilos.chips}>
            {!!cliente.ruta && <Chip compact icon="map-marker-path">{cliente.ruta}</Chip>}
            {cliente.orden_visita != null && <Chip compact icon="sort-numeric-ascending">orden {cliente.orden_visita}</Chip>}
            {dias.map((d) => <Chip key={d} compact>{NOMBRES_DIA[d]}</Chip>)}
          </View>
        </Card.Content>
        <Card.Actions>
          <Button
            icon="pencil"
            onPress={() => router.push({ pathname: '/cliente/nuevo', params: { editId: cliente.id } })}
          >
            Editar
          </Button>
          {!!cliente.telefono && (
            <Button icon="phone" onPress={() => Linking.openURL(`tel:${cliente.telefono}`)}>
              Llamar
            </Button>
          )}
          {cliente.lat != null && cliente.lng != null && (
            <Button
              icon="map"
              onPress={() => Linking.openURL(`geo:${cliente.lat},${cliente.lng}?q=${cliente.lat},${cliente.lng}(${encodeURIComponent(cliente.nombre)})`)}
            >
              Mapa
            </Button>
          )}
          <Button
            icon="plus"
            mode="contained"
            onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: 'nuevo', clienteId: cliente.id } })}
          >
            Pedido
          </Button>
        </Card.Actions>
      </Card>

      <SegmentedButtons
        value={vista}
        onValueChange={(v) => setVista(v as typeof vista)}
        style={estilos.segmentos}
        buttons={[
          { value: 'pedidos', label: `Pedidos (${pedidos.length})`, icon: 'receipt' },
          { value: 'devoluciones', label: `Devoluciones (${devoluciones.length})`, icon: 'backup-restore' },
        ]}
      />
      {vista === 'pedidos' ? (
        <FlatList
          data={pedidos}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={<Text style={estilos.vacio}>Sin pedidos todavía.</Text>}
          renderItem={({ item }) => (
            <TouchableRipple
              onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: item.id } })}
            >
              <View style={estilos.fila}>
                <MaterialCommunityIcons name="receipt" size={20} color={tema.colors.outline} />
                <Text style={{ flex: 1 }}>{formatoFecha(item.fecha)}</Text>
                <Text style={{ color: colorEstado[item.estado], fontWeight: '600' }}>{item.estado}</Text>
                <Text style={estilos.monto}>{formatoLempira(item.total ?? 0)}</Text>
              </View>
            </TouchableRipple>
          )}
        />
      ) : (
        <FlatList
          data={devoluciones}
          keyExtractor={(d) => d.id}
          ListEmptyComponent={
            <Text style={estilos.vacio}>
              Sin devoluciones. Se registran dentro del pedido con el botón ↩ de cada producto.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableRipple
              onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: item.pedido_id } })}
            >
              <View style={estilos.fila}>
                <MaterialCommunityIcons name="backup-restore" size={20} color={tema.colors.error} />
                <View style={{ flex: 1 }}>
                  <Text>{item.producto}</Text>
                  <Text variant="bodySmall" style={estilos.secundario}>{formatoFecha(item.fecha)}</Text>
                </View>
                <Text style={{ fontWeight: '600' }}>×{item.devueltas}</Text>
                <Text style={[estilos.monto, { color: tema.colors.error }]}>
                  −{formatoLempira(item.monto)}
                </Text>
              </View>
            </TouchableRipple>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  tarjeta: { margin: 16, backgroundColor: tema.colors.surfaceVariant },
  secundario: { color: tema.colors.onSurfaceVariant },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  segmentos: { marginHorizontal: 16, marginBottom: 8 },
  vacio: { textAlign: 'center', marginTop: 24, color: tema.colors.onSurfaceVariant },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  monto: { fontWeight: '700', minWidth: 86, textAlign: 'right' },
});
