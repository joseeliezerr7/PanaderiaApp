import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { FAB, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { BarraEstado } from '../../components/BarraEstado';
import { EstadoVacio } from '../../components/EstadoVacio';
import { esAdmin, useUsuarioActivo } from '../../hooks/useUsuarioActivo';
import { sincronizar } from '../../sync/sync';
import { colorEstado, formatoFecha, formatoLempira, tema } from '../../tema';

interface FilaPedido {
  id: string;
  fecha: string;
  estado: string;
  cliente: string;
  total: number | null;
}

export default function Pedidos() {
  const db = useSQLiteContext();
  const router = useRouter();
  const usuario = useUsuarioActivo();
  const [secciones, setSecciones] = useState<{ title: string; data: FilaPedido[] }[]>([]);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    const soloMios = usuario && !esAdmin(usuario);
    const filas = await db.getAllAsync<FilaPedido>(
      `SELECT p.id, p.fecha, p.estado, c.nombre AS cliente,
              (SELECT SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario)
                 FROM pedido_lineas l WHERE l.pedido_id = p.id AND l._deleted = 0) AS total
         FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
        WHERE p._deleted = 0
          ${soloMios ? 'AND (p.usuario_id = ? OR c.usuario_id = ?)' : ''}
        ORDER BY p.fecha DESC LIMIT 300`,
      soloMios ? [usuario.id, usuario.id] : [],
    );
    const grupos = new Map<string, FilaPedido[]>();
    for (const f of filas) {
      const dia = f.fecha.slice(0, 10);
      if (!grupos.has(dia)) grupos.set(dia, []);
      grupos.get(dia)!.push(f);
    }
    setSecciones([...grupos.entries()].map(([dia, data]) => ({
      title: formatoFecha(dia),
      data,
    })));
  }, [db, usuario]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const refrescar = async () => {
    setRefrescando(true);
    await sincronizar(db);
    await cargar();
    setRefrescando(false);
  };

  const q = busqueda.toLowerCase();
  const seccionesVisibles = q
    ? secciones
        .map((s) => ({ ...s, data: s.data.filter((p) => p.cliente.toLowerCase().includes(q)) }))
        .filter((s) => s.data.length > 0)
    : secciones;

  return (
    <View style={{ flex: 1 }}>
    <BarraEstado />
    <Searchbar
      placeholder="Buscar por cliente"
      value={busqueda}
      onChangeText={setBusqueda}
      style={estilos.buscador}
    />
    <SectionList
      sections={seccionesVisibles}
      keyExtractor={(f) => f.id}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      ListEmptyComponent={
        <EstadoVacio
          icono="clipboard-text-outline"
          titulo={busqueda ? 'Sin resultados' : 'Aún no hay pedidos'}
          detalle={busqueda ? 'Prueba con otro cliente.' : 'Toma tu primer pedido con el botón +.'}
          accion={busqueda ? undefined : { etiqueta: 'Nuevo pedido', icono: 'plus', onPress: () => router.push('/elegir-cliente') }}
        />
      }
      renderSectionHeader={({ section }) => (
        <View style={estilos.encabezadoSeccion}>
          <Text variant="labelLarge" style={{ color: tema.colors.primary }}>{section.title}</Text>
          <Text variant="labelMedium" style={{ color: tema.colors.onSurfaceVariant }}>
            {formatoLempira(section.data.reduce((s, p) => s + (p.total ?? 0), 0))}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <TouchableRipple
          onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: item.id } })}
        >
          <View style={estilos.fila}>
            <View style={[estilos.punto, { backgroundColor: colorEstado[item.estado] ?? tema.colors.outline }]} />
            <Text style={{ flex: 1 }} numberOfLines={1}>{item.cliente}</Text>
            <Text style={estilos.monto}>{formatoLempira(item.total ?? 0)}</Text>
          </View>
        </TouchableRipple>
      )}
    />
    <FAB
      icon="plus"
      label="Pedido"
      color="white"
      style={estilos.fab}
      onPress={() => router.push('/elegir-cliente')}
    />
    </View>
  );
}

const estilos = StyleSheet.create({
  buscador: { marginHorizontal: 16, marginVertical: 10, backgroundColor: tema.colors.surfaceVariant },
  vacio: { textAlign: 'center', marginTop: 48, color: tema.colors.onSurfaceVariant },
  encabezadoSeccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: tema.colors.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  punto: { width: 10, height: 10, borderRadius: 5 },
  monto: { fontWeight: '700' },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: tema.colors.primary },
});
