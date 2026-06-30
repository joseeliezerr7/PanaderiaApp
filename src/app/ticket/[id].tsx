import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Banner, Button, Divider, Text } from 'react-native-paper';
import { type Empresa, getEmpresa } from '../../store/ajustes';
import { formatoFecha, formatoLempira, tema } from '../../tema';

interface DatosTicket {
  pedido: { id: string; fecha: string; estado: string };
  cliente: { nombre: string; negocio: string | null };
  vendedor: string | null;
  lineas: { producto: string; cantidad: number; precio: number; devolucion: number }[];
}

export default function Ticket() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [datos, setDatos] = useState<DatosTicket | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    void (async () => {
      setCargando(true);
      setEmpresa(await getEmpresa());
      const pedido = await db.getFirstAsync<any>(
        `SELECT p.id, p.fecha, p.estado, c.nombre AS cliente_nombre, c.negocio,
                u.nombre AS vendedor
           FROM pedidos p
           JOIN clientes c ON c.id = p.cliente_id
           LEFT JOIN usuarios u ON u.id = p.usuario_id
          WHERE p.id = ?`, [id],
      );
      if (!pedido) {
        setCargando(false);
        return;
      }
      const lineas = await db.getAllAsync<any>(
        `SELECT pr.nombre AS producto, l.cantidad, l.precio_unitario AS precio,
                l.devolucion_anterior AS devolucion
           FROM pedido_lineas l JOIN productos pr ON pr.id = l.producto_id
          WHERE l.pedido_id = ? AND l._deleted = 0
          ORDER BY pr.orden`, [id],
      );
      setDatos({
        pedido: { id: pedido.id, fecha: pedido.fecha, estado: pedido.estado },
        cliente: { nombre: pedido.cliente_nombre, negocio: pedido.negocio },
        vendedor: pedido.vendedor,
        lineas,
      });
      setCargando(false);
    })();
  }, [db, id]);

  if (cargando || !empresa) {
    return (
      <View style={estilos.centro}>
        <Stack.Screen options={{ title: 'Ticket' }} />
        <ActivityIndicator size="large" color={tema.colors.primary} />
      </View>
    );
  }

  if (!datos) {
    return (
      <View style={estilos.centro}>
        <Stack.Screen options={{ title: 'Ticket' }} />
        <MaterialCommunityIcons name="receipt-text-remove" size={48} color={tema.colors.outline} />
        <Text variant="titleMedium">No se encontró el pedido</Text>
        <Button mode="contained-tonal" onPress={() => router.back()}>Volver</Button>
      </View>
    );
  }

  const datosIncompletos = !empresa.telefono && !empresa.direccion;

  const bruto = datos.lineas.reduce((s, l) => s + l.cantidad * l.precio, 0);
  const devoluciones = datos.lineas.reduce((s, l) => s + l.devolucion * l.precio, 0);
  const total = bruto - devoluciones;
  const numero = datos.pedido.id.slice(0, 8).toUpperCase();

  const compartir = async () => {
    setCompartiendo(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlTicket(empresa, datos, numero), width: 400 });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Ticket ${numero}` });
    } catch (e: any) {
      Alert.alert('No se pudo compartir', String(e?.message ?? e));
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <View style={estilos.pantalla}>
      <Stack.Screen options={{ title: `Ticket ${numero}` }} />
      {datosIncompletos && (
        <Banner
          visible
          icon="store-alert"
          actions={[{ label: 'Completar datos', onPress: () => router.push('/admin/negocio') }]}
        >
          Faltan los datos del negocio (teléfono/dirección). Complétalos para que la factura salga completa.
        </Banner>
      )}
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.papel}>
          <Text variant="titleLarge" style={estilos.empresa}>{empresa.nombre}</Text>
          {!!empresa.direccion && <Text style={estilos.centrado}>{empresa.direccion}</Text>}
          {!!empresa.telefono && <Text style={estilos.centrado}>Tel: {empresa.telefono}</Text>}
          {!!empresa.rtn && <Text style={estilos.centrado}>RTN: {empresa.rtn}</Text>}
          <Divider style={estilos.separador} />
          <Text style={estilos.tipoDoc}>
            {datos.pedido.estado === 'entregado' ? 'FACTURA / TICKET DE VENTA' : 'PEDIDO'}
          </Text>
          <Divider style={estilos.separador} />

          <View style={estilos.filaDatos}>
            <Text style={estilos.etiqueta}>Ticket</Text>
            <Text style={estilos.valor}>{numero}</Text>
          </View>
          <View style={estilos.filaDatos}>
            <Text style={estilos.etiqueta}>Fecha</Text>
            <Text style={estilos.valor}>{formatoFecha(datos.pedido.fecha)}</Text>
          </View>
          <View style={estilos.filaDatos}>
            <Text style={estilos.etiqueta}>Cliente</Text>
            <Text style={estilos.valor} numberOfLines={1}>{datos.cliente.nombre}</Text>
          </View>
          {!!datos.vendedor && (
            <View style={estilos.filaDatos}>
              <Text style={estilos.etiqueta}>Vendedor</Text>
              <Text style={estilos.valor}>{datos.vendedor}</Text>
            </View>
          )}
          <Divider style={estilos.separador} />

          {datos.lineas.filter((l) => l.cantidad > 0).map((l, i) => (
            <View key={i} style={estilos.filaLinea}>
              <Text style={{ flex: 1 }} numberOfLines={1}>{l.producto}</Text>
              <Text style={estilos.cant}>{l.cantidad} × {l.precio.toFixed(2)}</Text>
              <Text style={estilos.importe}>{(l.cantidad * l.precio).toFixed(2)}</Text>
            </View>
          ))}

          {devoluciones > 0 && (
            <>
              <Divider style={estilos.separador} />
              <Text style={estilos.tituloDev}>Devoluciones</Text>
              {datos.lineas.filter((l) => l.devolucion > 0).map((l, i) => (
                <View key={i} style={estilos.filaLinea}>
                  <Text style={[{ flex: 1 }, estilos.dev]} numberOfLines={1}>{l.producto}</Text>
                  <Text style={[estilos.cant, estilos.dev]}>{l.devolucion} × {l.precio.toFixed(2)}</Text>
                  <Text style={[estilos.importe, estilos.dev]}>−{(l.devolucion * l.precio).toFixed(2)}</Text>
                </View>
              ))}
            </>
          )}

          <Divider style={estilos.separador} />
          {devoluciones > 0 && (
            <View style={estilos.filaDatos}>
              <Text style={estilos.etiqueta}>Subtotal</Text>
              <Text style={estilos.valor}>{formatoLempira(bruto)}</Text>
            </View>
          )}
          <View style={estilos.filaTotal}>
            <Text variant="titleMedium" style={{ fontWeight: '800' }}>TOTAL</Text>
            <Text variant="titleMedium" style={{ fontWeight: '800' }}>{formatoLempira(total)}</Text>
          </View>
          <Text style={[estilos.centrado, estilos.gracias]}>¡Gracias por su compra!</Text>
        </View>
      </ScrollView>

      <View style={estilos.acciones}>
        <Button mode="outlined" onPress={() => router.back()} style={{ flex: 1 }}>
          Listo
        </Button>
        <Button
          mode="contained"
          icon="share-variant"
          onPress={compartir}
          loading={compartiendo}
          disabled={compartiendo}
          style={{ flex: 2 }}
        >
          Compartir / Imprimir
        </Button>
      </View>
    </View>
  );
}

function htmlTicket(e: Empresa, d: DatosTicket, numero: string): string {
  const bruto = d.lineas.reduce((s, l) => s + l.cantidad * l.precio, 0);
  const dev = d.lineas.reduce((s, l) => s + l.devolucion * l.precio, 0);
  const filas = d.lineas.filter((l) => l.cantidad > 0).map((l) => `
    <tr><td>${l.producto}</td><td class="c">${l.cantidad} × ${l.precio.toFixed(2)}</td>
        <td class="r">${(l.cantidad * l.precio).toFixed(2)}</td></tr>`).join('');
  const filasDev = d.lineas.filter((l) => l.devolucion > 0).map((l) => `
    <tr class="dev"><td>${l.producto}</td><td class="c">${l.devolucion} × ${l.precio.toFixed(2)}</td>
        <td class="r">−${(l.devolucion * l.precio).toFixed(2)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Courier New', monospace; font-size: 13px; margin: 24px; color: #222; }
    h1 { font-size: 19px; text-align: center; margin: 0 0 4px; }
    .centro { text-align: center; margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    td { padding: 3px 2px; }
    .c { text-align: center; white-space: nowrap; }
    .r { text-align: right; white-space: nowrap; }
    .dev { color: #a00; }
    hr { border: none; border-top: 1px dashed #777; margin: 8px 0; }
    .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
    .datos { margin: 2px 0; display: flex; justify-content: space-between; }
  </style></head><body>
    <h1>${e.nombre}</h1>
    ${e.direccion ? `<p class="centro">${e.direccion}</p>` : ''}
    ${e.telefono ? `<p class="centro">Tel: ${e.telefono}</p>` : ''}
    ${e.rtn ? `<p class="centro">RTN: ${e.rtn}</p>` : ''}
    <hr>
    <div class="datos"><span>Ticket</span><span>${numero}</span></div>
    <div class="datos"><span>Fecha</span><span>${d.pedido.fecha.slice(0, 10)}</span></div>
    <div class="datos"><span>Cliente</span><span>${d.cliente.nombre}</span></div>
    ${d.vendedor ? `<div class="datos"><span>Vendedor</span><span>${d.vendedor}</span></div>` : ''}
    <hr>
    <table>${filas}</table>
    ${dev > 0 ? `<hr><p><b>Devoluciones</b></p><table>${filasDev}</table>` : ''}
    <hr>
    ${dev > 0 ? `<div class="datos"><span>Subtotal</span><span>L ${bruto.toFixed(2)}</span></div>` : ''}
    <div class="total"><span>TOTAL</span><span>L ${(bruto - dev).toFixed(2)}</span></div>
    <p class="centro" style="margin-top:14px">¡Gracias por su compra!</p>
  </body></html>`;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  tipoDoc: { textAlign: 'center', fontWeight: '800', letterSpacing: 1, color: tema.colors.primary, fontSize: 13 },
  contenido: { padding: 16, paddingBottom: 100 },
  papel: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  empresa: { textAlign: 'center', fontWeight: '800' },
  centrado: { textAlign: 'center', color: '#444', fontSize: 12 },
  separador: { marginVertical: 10, borderStyle: 'dashed' },
  filaDatos: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 1 },
  etiqueta: { color: '#666' },
  valor: { fontWeight: '600', maxWidth: '65%' },
  filaLinea: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  cant: { color: '#555', minWidth: 80, textAlign: 'right' },
  importe: { fontWeight: '600', minWidth: 64, textAlign: 'right' },
  tituloDev: { fontWeight: '700', color: tema.colors.error, marginBottom: 2 },
  dev: { color: tema.colors.error },
  filaTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  gracias: { marginTop: 14 },
  acciones: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: tema.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.colors.outline,
  },
});
