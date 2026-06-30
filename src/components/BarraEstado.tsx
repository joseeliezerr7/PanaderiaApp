import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, TouchableRipple } from 'react-native-paper';
import { contarPendientes, sincronizar } from '../sync/sync';
import { tema } from '../tema';

/**
 * Barra fina de estado de sincronización. Se muestra solo cuando hay algo
 * que comunicar: sin conexión, o cambios locales pendientes de subir.
 * Cuando todo está al día, no ocupa espacio.
 */
export function BarraEstado() {
  const db = useSQLiteContext();
  const [online, setOnline] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const refrescar = useCallback(async () => {
    setPendientes(await contarPendientes(db));
  }, [db]);

  useEffect(() => {
    const sub = NetInfo.addEventListener((e) => setOnline(!!e.isConnected));
    return () => sub();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refrescar();
      const t = setInterval(refrescar, 4000);
      return () => clearInterval(t);
    }, [refrescar]),
  );

  if (online && pendientes === 0) return null;

  const sinConexion = !online;

  const sincronizarAhora = async () => {
    if (sinConexion || sincronizando) return;
    setSincronizando(true);
    await sincronizar(db);
    await refrescar();
    setSincronizando(false);
  };

  return (
    <TouchableRipple onPress={sincronizarAhora} disabled={sinConexion}>
      <View style={[estilos.barra, { backgroundColor: sinConexion ? '#9A6A00' : tema.colors.secondary }]}>
        {sincronizando ? (
          <ActivityIndicator size={14} color="white" />
        ) : (
          <MaterialCommunityIcons
            name={sinConexion ? 'cloud-off-outline' : 'cloud-sync-outline'}
            size={16}
            color="white"
          />
        )}
        <Text style={estilos.texto}>
          {sinConexion
            ? `Sin conexión · ${pendientes > 0 ? `${pendientes} sin guardar en la nube` : 'trabajando offline'}`
            : `${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} por subir · toca para sincronizar`}
        </Text>
      </View>
    </TouchableRipple>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  texto: { color: 'white', fontSize: 12, fontWeight: '600' },
});
