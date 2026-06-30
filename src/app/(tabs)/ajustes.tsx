import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { esAdmin, useUsuarioActivo } from '../../hooks/useUsuarioActivo';
import {
  type Empresa, EMPRESA_POR_DEFECTO, getEmpresa, getServerUrl,
  setEmpresa as guardarEmpresa, setServerUrl,
} from '../../store/ajustes';
import { useSession } from '../../store/session';
import { contarPendientes, leerMeta, sincronizar } from '../../sync/sync';
import { formatoFecha, tema } from '../../tema';

export default function Ajustes() {
  const db = useSQLiteContext();
  const router = useRouter();
  const usuario = useUsuarioActivo();
  const { logout } = useSession();
  const [url, setUrl] = useState('');
  const [pendientes, setPendientes] = useState(0);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [estado, setEstado] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa>(EMPRESA_POR_DEFECTO);
  const [empresaGuardada, setEmpresaGuardada] = useState('');

  const cargar = useCallback(async () => {
    setUrl(await getServerUrl());
    setEmpresa(await getEmpresa());
    setPendientes(await contarPendientes(db));
    setUltimaSync(await leerMeta(db, 'last_sync_en'));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const sincronizarAhora = async () => {
    setSincronizando(true);
    setEstado('');
    await setServerUrl(url);
    const r = await sincronizar(db);
    setEstado(r.ok ? `✓ ${r.detalle} — ${r.subidos} subidos, ${r.bajados} recibidos` : `✗ ${r.detalle}`);
    await cargar();
    setSincronizando(false);
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Card mode="contained" style={estilos.tarjeta}>
        <Card.Title title="Sincronización" />
        <Card.Content style={{ gap: 10 }}>
          <TextInput
            label="Servidor"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            mode="outlined"
            placeholder="http://192.168.1.100:8124"
          />
          <View style={estilos.filaDatos}>
            <Text variant="bodyMedium">Cambios pendientes de subir</Text>
            <Text variant="titleMedium" style={{ color: pendientes ? tema.colors.error : '#2E7D32' }}>
              {pendientes}
            </Text>
          </View>
          <View style={estilos.filaDatos}>
            <Text variant="bodyMedium">Última sincronización</Text>
            <Text variant="bodyMedium">
              {ultimaSync ? `${formatoFecha(ultimaSync)} ${ultimaSync.slice(11, 16)}` : 'nunca'}
            </Text>
          </View>
          {!!estado && <Text variant="bodySmall">{estado}</Text>}
        </Card.Content>
        <Card.Actions>
          <Button
            mode="contained"
            icon="sync"
            loading={sincronizando}
            disabled={sincronizando}
            onPress={sincronizarAhora}
          >
            Sincronizar ahora
          </Button>
        </Card.Actions>
      </Card>

      <Card mode="contained" style={estilos.tarjeta}>
        <Card.Title
          title="Sesión"
          subtitle={usuario ? `${usuario.nombre} · ${esAdmin(usuario) ? 'administrador' : 'vendedor'}` : 'sin sesión'}
        />
        <Card.Actions>
          <Button
            mode="outlined"
            icon="logout"
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Cerrar sesión
          </Button>
        </Card.Actions>
      </Card>

      <Card mode="contained" style={estilos.tarjeta}>
        <Card.Title title="Datos del negocio" subtitle="Aparecen en el ticket de entrega" />
        <Card.Content style={{ gap: 10 }}>
          <TextInput
            label="Nombre del negocio"
            value={empresa.nombre}
            onChangeText={(v) => setEmpresa({ ...empresa, nombre: v })}
            mode="outlined"
          />
          <TextInput
            label="Teléfono"
            value={empresa.telefono}
            onChangeText={(v) => setEmpresa({ ...empresa, telefono: v })}
            mode="outlined"
            keyboardType="phone-pad"
          />
          <TextInput
            label="Dirección"
            value={empresa.direccion}
            onChangeText={(v) => setEmpresa({ ...empresa, direccion: v })}
            mode="outlined"
          />
          <TextInput
            label="RTN (opcional)"
            value={empresa.rtn}
            onChangeText={(v) => setEmpresa({ ...empresa, rtn: v })}
            mode="outlined"
          />
          {!!empresaGuardada && <Text variant="bodySmall">{empresaGuardada}</Text>}
        </Card.Content>
        <Card.Actions>
          <Button
            mode="contained-tonal"
            icon="content-save"
            onPress={async () => {
              await guardarEmpresa(empresa);
              setEmpresaGuardada('✓ Guardado');
              setTimeout(() => setEmpresaGuardada(''), 2000);
            }}
          >
            Guardar datos
          </Button>
        </Card.Actions>
      </Card>

      <Text variant="bodySmall" style={estilos.pie}>
        Panadería · funciona sin internet; los cambios se sincronizan solos al recuperar señal.
      </Text>
      <Text variant="bodySmall" style={estilos.version}>
        Versión {Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: 16, gap: 16 },
  tarjeta: { backgroundColor: tema.colors.surfaceVariant },
  filaDatos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pie: { textAlign: 'center', color: tema.colors.onSurfaceVariant, marginTop: 8 },
  version: { textAlign: 'center', color: tema.colors.outline, marginTop: 2 },
});
