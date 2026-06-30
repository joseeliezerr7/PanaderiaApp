import * as Crypto from 'expo-crypto';
import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { hoyISO } from '../../db/database';
import { sincronizarEnFondo } from '../../sync/sync';
import { formatoLempira, tema } from '../../tema';

interface FilaPrecio {
  id: string;
  nombre: string;
  precio: number | null;
}

export default function Precios() {
  const db = useSQLiteContext();
  const [filas, setFilas] = useState<FilaPrecio[]>([]);
  const [editando, setEditando] = useState<FilaPrecio | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState('');

  const cargar = useCallback(async () => {
    setFilas(await db.getAllAsync<FilaPrecio>(
      `SELECT p.id, p.nombre,
              (SELECT precio FROM precios_producto pp
                WHERE pp.producto_id = p.id AND pp._deleted = 0 AND pp.vigente_desde <= ?
                ORDER BY pp.vigente_desde DESC LIMIT 1) AS precio
         FROM productos p
        WHERE p.activo = 1 AND p._deleted = 0
        ORDER BY p.orden`,
      [hoyISO()],
    ));
  }, [db]);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const abrir = (f: FilaPrecio) => {
    setEditando(f);
    setNuevoPrecio(f.precio != null ? String(f.precio) : '');
  };

  const guardar = async () => {
    if (!editando) return;
    const precio = parseFloat(nuevoPrecio.replace(',', '.'));
    if (isNaN(precio) || precio < 0) return;
    // nuevo registro de precio vigente desde hoy (mantiene historial); sincroniza
    await db.runAsync(
      `INSERT OR REPLACE INTO precios_producto
         (id, producto_id, precio, vigente_desde, _dirty, _deleted)
       VALUES (?, ?, ?, ?, 1, 0)`,
      [Crypto.randomUUID(), editando.id, precio, hoyISO()],
    );
    setEditando(null);
    sincronizarEnFondo(db);
    await cargar();
  };

  return (
    <View style={estilos.pantalla}>
      <Stack.Screen options={{ title: 'Productos y precios' }} />
      <FlatList
        data={filas}
        keyExtractor={(f) => f.id}
        ListHeaderComponent={
          <Text variant="bodySmall" style={estilos.nota}>
            Cambiar un precio crea uno nuevo vigente desde hoy; los pedidos anteriores conservan su precio.
            El cambio se sincroniza con el panel web.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={estilos.fila}>
            <Text variant="titleSmall" style={{ flex: 1 }}>{item.nombre}</Text>
            <Text variant="titleMedium" style={estilos.precio}>{formatoLempira(item.precio ?? 0)}</Text>
            <Button mode="text" compact onPress={() => abrir(item)}>Cambiar</Button>
          </View>
        )}
      />

      <Portal>
        <Dialog visible={!!editando} onDismiss={() => setEditando(null)}>
          <Dialog.Title>{editando?.nombre}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nuevo precio (L)"
              value={nuevoPrecio}
              onChangeText={(t) => setNuevoPrecio(t.replace(/[^0-9.,]/g, ''))}
              mode="outlined"
              keyboardType="decimal-pad"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditando(null)}>Cancelar</Button>
            <Button mode="contained" onPress={guardar}>Guardar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  nota: { color: tema.colors.onSurfaceVariant, padding: 16 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 8,
    gap: 8,
  },
  precio: { fontWeight: '700' },
});
