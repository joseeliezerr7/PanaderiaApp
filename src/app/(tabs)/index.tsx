import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, FAB, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { BarraEstado } from '../../components/BarraEstado';
import { NOMBRES_DIA, diaNumHoy, hoyISO } from '../../db/database';
import { esAdmin, useUsuarioActivo } from '../../hooks/useUsuarioActivo';
import { sincronizar } from '../../sync/sync';
import { colorEstado, formatoLempira, tema } from '../../tema';

interface FilaHoy {
  id: string;
  nombre: string;
  negocio: string | null;
  orden_visita: number | null;
  ruta: string | null;
  pedido_id: string | null;
  pedido_estado: string | null;
  total: number | null;
}

export default function Hoy() {
  const db = useSQLiteContext();
  const router = useRouter();
  const usuario = useUsuarioActivo();
  const [filas, setFilas] = useState<FilaHoy[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    const soloMios = usuario && !esAdmin(usuario);
    const resultado = await db.getAllAsync<FilaHoy>(
      `SELECT c.id, c.nombre, c.negocio, c.orden_visita, r.nombre AS ruta,
              p.id AS pedido_id, p.estado AS pedido_estado,
              (SELECT SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario)
                 FROM pedido_lineas l
                WHERE l.pedido_id = p.id AND l._deleted = 0) AS total
         FROM clientes c
         JOIN cliente_dias_visita d
           ON d.cliente_id = c.id AND d.dia_num = ? AND d._deleted = 0
         LEFT JOIN rutas r ON r.id = c.ruta_id
         LEFT JOIN pedidos p
           ON p.cliente_id = c.id AND substr(p.fecha, 1, 10) = ? AND p._deleted = 0
        WHERE c.activo = 1 AND c._deleted = 0
          ${soloMios ? 'AND c.usuario_id = ?' : ''}
        ORDER BY c.orden_visita IS NULL, c.orden_visita`,
      soloMios ? [diaNumHoy(), hoyISO(), usuario.id] : [diaNumHoy(), hoyISO()],
    );
    setFilas(resultado);
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

  const visibles = filas.filter((f) => {
    const q = busqueda.toLowerCase();
    return !q || f.nombre.toLowerCase().includes(q) || (f.negocio ?? '').toLowerCase().includes(q);
  });
  const visitados = filas.filter((f) => f.pedido_id).length;

  const abrir = (f: FilaHoy) => {
    if (f.pedido_id) {
      router.push({ pathname: '/pedido/[id]', params: { id: f.pedido_id } });
    } else {
      router.push({ pathname: '/pedido/[id]', params: { id: 'nuevo', clienteId: f.id } });
    }
  };

  return (
    <View style={estilos.pantalla}>
      <BarraEstado />
      <View style={estilos.encabezado}>
        <View>
          <Text variant="titleMedium" style={estilos.tituloDia}>
            Ruta del {NOMBRES_DIA[diaNumHoy()]}
          </Text>
          {usuario && (
            <Text variant="bodySmall" style={estilos.progreso}>
              {usuario.nombre} · {esAdmin(usuario) ? 'administrador (ve todo)' : 'vendedor'}
            </Text>
          )}
        </View>
        <TouchableRipple onPress={() => router.push('/cierre')} style={estilos.cierre} borderless>
          <View style={estilos.cierreInterior}>
            <MaterialCommunityIcons name="cash-register" size={18} color={tema.colors.primary} />
            <Text variant="labelMedium" style={{ color: tema.colors.primary }}>Cierre</Text>
          </View>
        </TouchableRipple>
      </View>
      <Text variant="bodySmall" style={estilos.progresoLinea}>
        {visitados} de {filas.length} clientes atendidos hoy
      </Text>
      <Searchbar
        placeholder="Buscar cliente o negocio"
        value={busqueda}
        onChangeText={setBusqueda}
        style={estilos.buscador}
      />
      <FlatList
        data={visibles}
        keyExtractor={(f) => f.id}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        ListEmptyComponent={
          <View style={estilos.vacioCaja}>
            <Text style={estilos.vacio}>
              {filas.length === 0
                ? `Hoy ${NOMBRES_DIA[diaNumHoy()]} no hay clientes programados.`
                : 'Sin resultados para la búsqueda.'}
            </Text>
            {filas.length === 0 && (
              <Button mode="contained-tonal" icon="plus" onPress={() => router.push('/elegir-cliente')}>
                Tomar pedido igual
              </Button>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableRipple onPress={() => abrir(item)}>
            <View style={estilos.fila}>
              <View style={estilos.orden}>
                <Text style={estilos.ordenTexto}>{item.orden_visita ?? '–'}</Text>
              </View>
              <View style={estilos.centro}>
                <Text variant="titleSmall" numberOfLines={1}>{item.nombre}</Text>
                {!!item.negocio && (
                  <Text variant="bodySmall" style={estilos.secundario} numberOfLines={1}>
                    {item.negocio}
                  </Text>
                )}
              </View>
              {item.pedido_id ? (
                <View style={estilos.derecha}>
                  <Text style={[estilos.monto, { color: colorEstado[item.pedido_estado ?? ''] ?? tema.colors.primary }]}>
                    {formatoLempira(item.total ?? 0)}
                  </Text>
                  <MaterialCommunityIcons name="check-circle" size={22} color="#2E7D32" />
                </View>
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={26} color={tema.colors.outline} />
              )}
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
  pantalla: { flex: 1 },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tituloDia: { color: tema.colors.primary, textTransform: 'capitalize' },
  progreso: { color: tema.colors.onSurfaceVariant },
  progresoLinea: { color: tema.colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 2 },
  cierre: { borderRadius: 20 },
  cierreInterior: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: tema.colors.primaryContainer,
    borderRadius: 20,
  },
  buscador: { marginHorizontal: 16, marginVertical: 10, backgroundColor: tema.colors.surfaceVariant },
  vacio: { textAlign: 'center', color: tema.colors.onSurfaceVariant, paddingHorizontal: 32 },
  vacioCaja: { alignItems: 'center', gap: 16, marginTop: 48 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: tema.colors.primary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  orden: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tema.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordenTexto: { fontWeight: '700', color: tema.colors.onPrimaryContainer },
  centro: { flex: 1 },
  secundario: { color: tema.colors.onSurfaceVariant },
  derecha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monto: { fontWeight: '700' },
});
