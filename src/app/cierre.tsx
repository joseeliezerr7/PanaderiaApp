import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';
import { hoyISO } from '../db/database';
import { esAdmin, useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { formatoFecha, formatoLempira, tema } from '../tema';

interface Resumen {
  total: number;
  pedidos: number;
  entregados: number;
  devoluciones: number;
  unidades: number;
}
interface FilaProducto { nombre: string; unidades: number; total: number }

export default function Cierre() {
  const db = useSQLiteContext();
  const usuario = useUsuarioActivo();
  const [r, setR] = useState<Resumen>({ total: 0, pedidos: 0, entregados: 0, devoluciones: 0, unidades: 0 });
  const [productos, setProductos] = useState<FilaProducto[]>([]);

  const cargar = useCallback(async () => {
    const soloMios = usuario && !esAdmin(usuario);
    const filtro = soloMios ? 'AND p.usuario_id = ?' : '';
    const args = soloMios ? [hoyISO(), usuario.id] : [hoyISO()];

    const res = await db.getFirstAsync<Resumen>(
      `SELECT
         COALESCE(SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario), 0) AS total,
         COUNT(DISTINCT p.id) AS pedidos,
         COUNT(DISTINCT CASE WHEN p.estado = 'entregado' THEN p.id END) AS entregados,
         COALESCE(SUM(l.devolucion_anterior * l.precio_unitario), 0) AS devoluciones,
         COALESCE(SUM(l.cantidad), 0) AS unidades
       FROM pedidos p
       JOIN pedido_lineas l ON l.pedido_id = p.id AND l._deleted = 0
      WHERE p._deleted = 0 AND p.estado != 'cancelado'
        AND substr(p.fecha,1,10) = ? ${filtro}`,
      args,
    );
    setR(res ?? { total: 0, pedidos: 0, entregados: 0, devoluciones: 0, unidades: 0 });

    setProductos(await db.getAllAsync<FilaProducto>(
      `SELECT pr.nombre, SUM(l.cantidad) AS unidades,
              SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario) AS total
         FROM pedidos p
         JOIN pedido_lineas l ON l.pedido_id = p.id AND l._deleted = 0
         JOIN productos pr ON pr.id = l.producto_id
        WHERE p._deleted = 0 AND p.estado != 'cancelado'
          AND substr(p.fecha,1,10) = ? ${filtro}
        GROUP BY l.producto_id ORDER BY unidades DESC`,
      args,
    ));
  }, [db, usuario]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Stack.Screen options={{ title: 'Cierre del día' }} />

      <View style={estilos.cabecera}>
        <Text variant="titleMedium" style={{ color: tema.colors.primary, fontWeight: '700' }}>
          {formatoFecha(hoyISO())}
        </Text>
        <Text variant="bodySmall" style={estilos.secundario}>
          {usuario ? (esAdmin(usuario) ? 'Todos los vendedores' : usuario.nombre) : ''}
        </Text>
      </View>

      <Card mode="contained" style={estilos.totalCard}>
        <Card.Content style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="bodyMedium" style={{ color: '#FFE6C7' }}>Total vendido hoy</Text>
          <Text variant="displaySmall" style={estilos.totalNum}>{formatoLempira(r.total)}</Text>
          {r.devoluciones > 0 && (
            <Text variant="bodySmall" style={{ color: '#FFE6C7' }}>
              (ya descontadas {formatoLempira(r.devoluciones)} en devoluciones)
            </Text>
          )}
        </Card.Content>
      </Card>

      <View style={estilos.mini}>
        <Mini icono="clipboard-list" valor={String(r.pedidos)} etiqueta="Pedidos" />
        <Mini icono="check-circle" valor={String(r.entregados)} etiqueta="Entregados" />
        <Mini icono="basket" valor={String(r.unidades)} etiqueta="Unidades" />
      </View>

      <Card mode="contained" style={estilos.tarjeta}>
        <Card.Title
          title="Detalle por producto"
          left={(p) => <MaterialCommunityIcons {...p} name="bread-slice" size={24} color={tema.colors.primary} />}
        />
        <Card.Content>
          {productos.length === 0 ? (
            <Text style={estilos.secundario}>Aún no hay ventas registradas hoy.</Text>
          ) : productos.map((pr, i) => (
            <View key={i}>
              <View style={estilos.filaProd}>
                <Text style={{ flex: 1 }} numberOfLines={1}>{pr.nombre}</Text>
                <Text style={estilos.unidades}>{pr.unidades} u</Text>
                <Text style={estilos.montoProd}>{formatoLempira(pr.total)}</Text>
              </View>
              <Divider />
            </View>
          ))}
        </Card.Content>
      </Card>

      <Text variant="bodySmall" style={[estilos.secundario, { textAlign: 'center', marginTop: 4 }]}>
        Efectivo a entregar: {formatoLempira(r.total)}
      </Text>
    </ScrollView>
  );
}

function Mini({ icono, valor, etiqueta }: { icono: any; valor: string; etiqueta: string }) {
  return (
    <Card mode="contained" style={estilos.miniCard}>
      <Card.Content style={{ alignItems: 'center', gap: 2 }}>
        <MaterialCommunityIcons name={icono} size={24} color={tema.colors.primary} />
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>{valor}</Text>
        <Text variant="bodySmall" style={estilos.secundario}>{etiqueta}</Text>
      </Card.Content>
    </Card>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: 16, gap: 14 },
  cabecera: { alignItems: 'center' },
  secundario: { color: tema.colors.onSurfaceVariant },
  totalCard: { backgroundColor: tema.colors.primary },
  totalNum: { color: 'white', fontWeight: '800' },
  mini: { flexDirection: 'row', gap: 10 },
  miniCard: { flex: 1, backgroundColor: tema.colors.surfaceVariant },
  tarjeta: { backgroundColor: tema.colors.surfaceVariant },
  filaProd: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  unidades: { color: tema.colors.onSurfaceVariant, minWidth: 44, textAlign: 'right' },
  montoProd: { fontWeight: '700', minWidth: 86, textAlign: 'right' },
});
