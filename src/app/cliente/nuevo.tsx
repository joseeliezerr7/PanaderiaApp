import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Text, TextInput } from 'react-native-paper';
import { NOMBRES_DIA } from '../../db/database';
import type { Cliente, Ruta } from '../../db/types';
import { getVendedorId } from '../../store/ajustes';
import { sincronizarEnFondo } from '../../sync/sync';
import { tema } from '../../tema';

export default function FormCliente() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editando = !!editId;

  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [nombre, setNombre] = useState('');
  const [negocio, setNegocio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [rutaId, setRutaId] = useState<string | null>(null);
  const [orden, setOrden] = useState('');
  const [dias, setDias] = useState<number[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    void (async () => {
      setRutas(await db.getAllAsync<Ruta>(
        'SELECT * FROM rutas WHERE activa = 1 AND _deleted = 0 ORDER BY nombre',
      ));
      if (editId) {
        const c = await db.getFirstAsync<Cliente>('SELECT * FROM clientes WHERE id = ?', [editId]);
        if (c) {
          setNombre(c.nombre);
          setNegocio(c.negocio ?? '');
          setTelefono(c.telefono ?? '');
          setDireccion(c.direccion ?? '');
          setRutaId(c.ruta_id);
          setOrden(c.orden_visita != null ? String(c.orden_visita) : '');
          setActivo(c.activo === 1);
          if (c.lat != null && c.lng != null) setCoords({ lat: c.lat, lng: c.lng });
        }
        setDias((await db.getAllAsync<{ dia_num: number }>(
          'SELECT dia_num FROM cliente_dias_visita WHERE cliente_id = ? AND _deleted = 0', [editId],
        )).map((d) => d.dia_num));
      }
    })();
  }, [db, editId]);

  const alternarDia = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const capturarUbicacion = async () => {
    setUbicando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Activa el permiso de ubicación para guardar la posición del cliente.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: any) {
      Alert.alert('No se pudo obtener la ubicación', String(e?.message ?? e));
    } finally {
      setUbicando(false);
    }
  };

  const cambiarEstado = () => {
    const desactivar = activo;
    Alert.alert(
      desactivar ? 'Desactivar cliente' : 'Reactivar cliente',
      desactivar
        ? 'Dejará de aparecer en las listas y rutas, pero su historial se conserva.'
        : 'Volverá a aparecer en las listas y rutas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: desactivar ? 'Desactivar' : 'Reactivar',
          style: desactivar ? 'destructive' : 'default',
          onPress: async () => {
            await db.runAsync(
              'UPDATE clientes SET activo = ?, _dirty = 1 WHERE id = ?',
              [desactivar ? 0 : 1, editId ?? ''],
            );
            setActivo(!desactivar);
            sincronizarEnFondo(db);
            router.back();
          },
        },
      ],
    );
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Escribe al menos el nombre del cliente.');
      return;
    }
    setGuardando(true);
    try {
      const id = editId ?? Crypto.randomUUID();
      await db.withTransactionAsync(async () => {
        if (editando) {
          await db.runAsync(
            `UPDATE clientes SET nombre=?, negocio=?, direccion=?, telefono=?, lat=?, lng=?,
                    ruta_id=?, orden_visita=?, _dirty=1 WHERE id=?`,
            [nombre.trim(), negocio.trim() || null, direccion.trim() || null, telefono.trim() || null,
             coords?.lat ?? null, coords?.lng ?? null, rutaId, orden ? Number(orden) : null, id],
          );
          // resincronizar días: borrar (soft) los actuales y reinsertar
          await db.runAsync('UPDATE cliente_dias_visita SET _deleted=1, _dirty=1 WHERE cliente_id=?', [id]);
        } else {
          const vendedor = await getVendedorId();
          await db.runAsync(
            `INSERT INTO clientes (id, nombre, negocio, direccion, telefono, lat, lng, ruta_id, orden_visita, usuario_id, activo, _dirty, _deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)`,
            [id, nombre.trim(), negocio.trim() || null, direccion.trim() || null, telefono.trim() || null,
             coords?.lat ?? null, coords?.lng ?? null, rutaId, orden ? Number(orden) : null, vendedor],
          );
        }
        for (const d of dias) {
          await db.runAsync(
            `INSERT INTO cliente_dias_visita (id, cliente_id, dia_num, _dirty, _deleted)
             VALUES (?, ?, ?, 1, 0)`,
            [Crypto.randomUUID(), id, d],
          );
        }
      });
      sincronizarEnFondo(db);
      router.replace({ pathname: '/cliente/[id]', params: { id } });
    } catch (e: any) {
      Alert.alert('No se pudo guardar', String(e?.message ?? e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: editando ? 'Editar cliente' : 'Nuevo cliente' }} />
      <TextInput label="Nombre *" value={nombre} onChangeText={setNombre} mode="outlined" />
      <TextInput label="Negocio (pulpería, tienda…)" value={negocio} onChangeText={setNegocio} mode="outlined" />
      <TextInput label="Teléfono" value={telefono} onChangeText={setTelefono} mode="outlined" keyboardType="phone-pad" />
      <TextInput label="Dirección" value={direccion} onChangeText={setDireccion} mode="outlined" multiline />

      <View style={estilos.ubicacion}>
        <Button
          mode={coords ? 'contained-tonal' : 'outlined'}
          icon={coords ? 'map-marker-check' : 'map-marker-plus'}
          onPress={capturarUbicacion}
          loading={ubicando}
          disabled={ubicando}
        >
          {coords ? 'Ubicación guardada' : 'Capturar ubicación GPS'}
        </Button>
        {coords && (
          <HelperText type="info" visible>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </HelperText>
        )}
      </View>

      <Text variant="titleSmall" style={estilos.etiqueta}>Ruta</Text>
      <View style={estilos.chips}>
        {rutas.map((r) => (
          <Chip key={r.id} selected={rutaId === r.id} onPress={() => setRutaId(rutaId === r.id ? null : r.id)} compact>
            {r.nombre}
          </Chip>
        ))}
      </View>

      <Text variant="titleSmall" style={estilos.etiqueta}>Días de visita</Text>
      <View style={estilos.chips}>
        {Object.entries(NOMBRES_DIA).map(([num, dia]) => (
          <Chip key={num} selected={dias.includes(Number(num))} onPress={() => alternarDia(Number(num))} compact>
            {dia}
          </Chip>
        ))}
      </View>

      <TextInput
        label="Orden de visita (opcional)"
        value={orden}
        onChangeText={(t) => setOrden(t.replace(/[^0-9]/g, ''))}
        mode="outlined"
        keyboardType="number-pad"
      />

      <Button
        mode="contained"
        icon="content-save"
        onPress={guardar}
        loading={guardando}
        disabled={guardando}
        style={{ marginTop: 8 }}
      >
        {editando ? 'Guardar cambios' : 'Guardar cliente'}
      </Button>

      {editando && (
        <Button
          mode="text"
          textColor={activo ? tema.colors.error : tema.colors.primary}
          icon={activo ? 'account-off' : 'account-check'}
          onPress={cambiarEstado}
          style={{ marginTop: 4 }}
        >
          {activo ? 'Desactivar cliente' : 'Reactivar cliente'}
        </Button>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: 16, gap: 12 },
  etiqueta: { color: tema.colors.primary, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ubicacion: { gap: 0 },
});
