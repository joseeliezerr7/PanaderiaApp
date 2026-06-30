import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, SegmentedButtons, Text, TouchableRipple } from 'react-native-paper';
import { esAdmin, useUsuarioActivo } from '../../hooks/useUsuarioActivo';
import { formatoLempira, tema } from '../../tema';

type Periodo = 'hoy' | 'semana' | 'mes';

const RANGO: Record<Periodo, string> = {
  hoy: "date('now', 'localtime')",
  semana: "date('now', 'localtime', '-6 days')",
  mes: "date('now', 'localtime', 'start of month')",
};

interface Kpis {
  total: number;
  pedidos: number;
  devoluciones: number;
  unidades: number;
}
interface Grupo { nombre: string; total: number; pedidos: number }
interface TopProducto { nombre: string; unidades: number; total: number }

export default function Admin() {
  const db = useSQLiteContext();
  const router = useRouter();
  const usuario = useUsuarioActivo();
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [kpis, setKpis] = useState<Kpis>({ total: 0, pedidos: 0, devoluciones: 0, unidades: 0 });
  const [porVendedor, setPorVendedor] = useState<Grupo[]>([]);
  const [porRuta, setPorRuta] = useState<Grupo[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);

  const cargar = useCallback(async () => {
    const desde = RANGO[periodo];
    const cond = `p._deleted = 0 AND p.estado != 'cancelado' AND substr(p.fecha,1,10) >= ${desde}`;

    const k = await db.getFirstAsync<Kpis>(
      `SELECT
         COALESCE(SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario), 0) AS total,
         COUNT(DISTINCT p.id) AS pedidos,
         COALESCE(SUM(l.devolucion_anterior * l.precio_unitario), 0) AS devoluciones,
         COALESCE(SUM(l.cantidad), 0) AS unidades
       FROM pedidos p
       JOIN pedido_lineas l ON l.pedido_id = p.id AND l._deleted = 0
      WHERE ${cond}`,
    );
    setKpis(k ?? { total: 0, pedidos: 0, devoluciones: 0, unidades: 0 });

    setPorVendedor(await db.getAllAsync<Grupo>(
      `SELECT COALESCE(u.nombre, 'Sin vendedor') AS nombre,
              SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario) AS total,
              COUNT(DISTINCT p.id) AS pedidos
         FROM pedidos p
         JOIN pedido_lineas l ON l.pedido_id = p.id AND l._deleted = 0
         LEFT JOIN usuarios u ON u.id = p.usuario_id
        WHERE ${cond}
        GROUP BY p.usuario_id ORDER BY total DESC`,
    ));

    setPorRuta(await db.getAllAsync<Grupo>(
      `SELECT COALESCE(r.nombre, 'Sin ruta') AS nombre,
              SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario) AS total,
              COUNT(DISTINCT p.id) AS pedidos
         FROM pedidos p
         JOIN clientes c ON c.id = p.cliente_id
         JOIN pedido_lineas l ON l.pedido_id = p.id AND l._deleted = 0
         LEFT JOIN rutas r ON r.id = c.ruta_id
        WHERE ${cond}
        GROUP BY c.ruta_id ORDER BY total DESC LIMIT 12`,
    ));

    setTopProductos(await db.getAllAsync<TopProducto>(
      `SELECT pr.nombre,
              SUM(l.cantidad) AS unidades,
              SUM((l.cantidad - l.devolucion_anterior) * l.precio_unitario) AS total
         FROM pedidos p
         JOIN pedido_lineas l ON l.pedido_id = p.id AND l._deleted = 0
         JOIN productos pr ON pr.id = l.producto_id
        WHERE ${cond}
        GROUP BY l.producto_id ORDER BY unidades DESC LIMIT 8`,
    ));
  }, [db, periodo]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  if (usuario && !esAdmin(usuario)) {
    return (
      <View style={estilos.bloqueado}>
        <MaterialCommunityIcons name="lock" size={48} color={tema.colors.outline} />
        <Text variant="titleMedium" style={{ textAlign: 'center' }}>Solo para administradores</Text>
        <Text variant="bodyMedium" style={estilos.secundario}>
          Cambia a un usuario administrador en Ajustes para ver el panel.
        </Text>
      </View>
    );
  }

  const ticketProm = kpis.pedidos > 0 ? kpis.total / kpis.pedidos : 0;

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <TouchableRipple onPress={() => router.push('/admin/panel')} style={estilos.heroRipple} borderless>
        <View style={estilos.hero}>
          <View style={estilos.heroIcono}>
            <MaterialCommunityIcons name="laptop" size={28} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={estilos.heroTitulo}>Panel administrativo</Text>
            <Text variant="bodySmall" style={estilos.heroSubtitulo}>
              Sistema completo de Laravel: clientes, pedidos, reportes
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={26} color="white" />
        </View>
      </TouchableRipple>

      <View style={estilos.accesos}>
        <Button
          mode="contained-tonal"
          icon="store-cog"
          style={{ flex: 1 }}
          onPress={() => router.push('/admin/negocio')}
        >
          Negocio
        </Button>
        <Button
          mode="contained-tonal"
          icon="tag-multiple"
          style={{ flex: 1 }}
          onPress={() => router.push('/admin/precios')}
        >
          Precios
        </Button>
      </View>

      <Divider style={{ marginVertical: 4 }} />
      <Text variant="titleSmall" style={estilos.tituloReportes}>Reportes</Text>

      <SegmentedButtons
        value={periodo}
        onValueChange={(v) => setPeriodo(v as Periodo)}
        buttons={[
          { value: 'hoy', label: 'Hoy' },
          { value: 'semana', label: '7 días' },
          { value: 'mes', label: 'Mes' },
        ]}
      />

      <View style={estilos.kpis}>
        <Kpi etiqueta="Vendido" valor={formatoLempira(kpis.total)} icono="cash-multiple" destacado />
        <Kpi etiqueta="Pedidos" valor={String(kpis.pedidos)} icono="clipboard-list" />
        <Kpi etiqueta="Ticket prom." valor={formatoLempira(ticketProm)} icono="chart-line" />
        <Kpi etiqueta="Devoluciones" valor={formatoLempira(kpis.devoluciones)} icono="backup-restore" alerta />
      </View>

      <Seccion titulo="Ventas por vendedor" icono="account-group">
        {porVendedor.length === 0 ? <Vacio /> : porVendedor.map((g, i) => (
          <FilaGrupo key={i} nombre={g.nombre} detalle={`${g.pedidos} pedidos`} total={g.total} />
        ))}
      </Seccion>

      <Seccion titulo="Ventas por ruta" icono="map-marker-path">
        {porRuta.length === 0 ? <Vacio /> : porRuta.map((g, i) => (
          <FilaGrupo key={i} nombre={g.nombre} detalle={`${g.pedidos} pedidos`} total={g.total} />
        ))}
      </Seccion>

      <Seccion titulo="Productos más vendidos" icono="bread-slice">
        {topProductos.length === 0 ? <Vacio /> : topProductos.map((p, i) => (
          <FilaGrupo key={i} nombre={p.nombre} detalle={`${p.unidades} unidades`} total={p.total} />
        ))}
      </Seccion>

    </ScrollView>
  );
}

function Kpi({ etiqueta, valor, icono, destacado, alerta }: {
  etiqueta: string; valor: string; icono: any; destacado?: boolean; alerta?: boolean;
}) {
  return (
    <Card mode="contained" style={[estilos.kpi, destacado && estilos.kpiDestacado]}>
      <Card.Content style={estilos.kpiContenido}>
        <MaterialCommunityIcons
          name={icono}
          size={22}
          color={alerta ? tema.colors.error : destacado ? tema.colors.onPrimary : tema.colors.primary}
        />
        <Text variant="titleMedium" style={[estilos.kpiValor, destacado && { color: tema.colors.onPrimary }]}>
          {valor}
        </Text>
        <Text variant="bodySmall" style={destacado ? { color: '#FFE6C7' } : estilos.secundario}>
          {etiqueta}
        </Text>
      </Card.Content>
    </Card>
  );
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: any; children: React.ReactNode }) {
  return (
    <Card mode="contained" style={estilos.tarjeta}>
      <Card.Title
        title={titulo}
        left={(p) => <MaterialCommunityIcons {...p} name={icono} size={24} color={tema.colors.primary} />}
      />
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}

function FilaGrupo({ nombre, detalle, total }: { nombre: string; detalle: string; total: number }) {
  return (
    <View>
      <View style={estilos.filaGrupo}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge" numberOfLines={1}>{nombre}</Text>
          <Text variant="bodySmall" style={estilos.secundario}>{detalle}</Text>
        </View>
        <Text variant="titleSmall" style={{ fontWeight: '700' }}>{formatoLempira(total)}</Text>
      </View>
      <Divider />
    </View>
  );
}

const Vacio = () => <Text style={estilos.secundario}>Sin datos en este período.</Text>;

const estilos = StyleSheet.create({
  contenido: { padding: 16, gap: 14 },
  bloqueado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  secundario: { color: tema.colors.onSurfaceVariant, textAlign: 'center' },
  heroRipple: { borderRadius: 16 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: tema.colors.primary,
  },
  heroIcono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroTitulo: { color: 'white', fontWeight: '800' },
  heroSubtitulo: { color: '#FFE6C7' },
  accesos: { flexDirection: 'row', gap: 10 },
  tituloReportes: { color: tema.colors.primary, marginTop: 2 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: tema.colors.surfaceVariant },
  kpiDestacado: { backgroundColor: tema.colors.primary },
  kpiContenido: { gap: 2 },
  kpiValor: { fontWeight: '800' },
  tarjeta: { backgroundColor: tema.colors.surfaceVariant },
  filaGrupo: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
});
