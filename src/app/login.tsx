import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, HelperText, Portal, Text, TextInput, TouchableRipple } from 'react-native-paper';
import type { Usuario } from '../db/types';
import { useSession } from '../store/session';
import { getServerUrl, setServerUrl } from '../store/ajustes';
import { sincronizar } from '../sync/sync';
import { tema } from '../tema';

export default function Login() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { login } = useSession();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [url, setUrl] = useState('');

  const cargarUsuarios = useCallback(async () => {
    setUsuarios(await db.getAllAsync<Usuario>(
      `SELECT * FROM usuarios WHERE activo = 1 AND _deleted = 0 ORDER BY rol DESC, nombre`,
    ));
  }, [db]);

  useEffect(() => {
    void cargarUsuarios();
    void getServerUrl().then(setUrl);
  }, [cargarUsuarios]);

  const sincronizarAhora = async () => {
    setSincronizando(true);
    setError('');
    const r = await sincronizar(db);
    await cargarUsuarios();
    if (!r.ok) setError(r.detalle);
    setSincronizando(false);
  };

  const entrar = async () => {
    if (!elegido) return;
    const pinReal = elegido.pin?.trim();
    // Si el usuario no tiene PIN configurado, se permite entrar sin PIN.
    if (pinReal && pin.trim() !== pinReal) {
      setError('PIN incorrecto');
      return;
    }
    await login(elegido);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.marca}>
          <View style={estilos.logo}>
            <MaterialCommunityIcons name="bread-slice" size={44} color={tema.colors.onPrimary} />
          </View>
          <Text variant="headlineMedium" style={estilos.titulo}>Panadería</Text>
          <Text variant="bodyMedium" style={estilos.subtitulo}>Ventas en ruta</Text>
        </View>

        {usuarios.length === 0 ? (
          <Card mode="contained" style={estilos.tarjeta}>
            <Card.Content style={{ gap: 12, alignItems: 'center' }}>
              <Text variant="titleMedium" style={{ textAlign: 'center' }}>
                Primer uso
              </Text>
              <Text variant="bodyMedium" style={estilos.ayuda}>
                Conéctate al WiFi de la panadería y sincroniza para descargar los usuarios.
              </Text>
              <Button
                mode="contained"
                icon="sync"
                onPress={sincronizarAhora}
                loading={sincronizando}
                disabled={sincronizando}
              >
                Sincronizar
              </Button>
              <Button compact onPress={() => setConfigVisible(true)}>Configurar servidor</Button>
              {!!error && <HelperText type="error" visible>{error}</HelperText>}
            </Card.Content>
          </Card>
        ) : (
          <Card mode="contained" style={estilos.tarjeta}>
            <Card.Content style={{ gap: 6 }}>
              <Text variant="titleMedium" style={{ marginBottom: 6 }}>¿Quién eres?</Text>
              {usuarios.map((u) => (
                <TouchableRipple
                  key={u.id}
                  onPress={() => { setElegido(u); setPin(''); setError(''); }}
                  style={[estilos.usuario, elegido?.id === u.id && estilos.usuarioActivo]}
                >
                  <View style={estilos.usuarioFila}>
                    <MaterialCommunityIcons
                      name={u.rol === 'admin' ? 'shield-account' : 'account'}
                      size={26}
                      color={elegido?.id === u.id ? tema.colors.primary : tema.colors.outline}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="titleSmall">{u.nombre}</Text>
                      <Text variant="bodySmall" style={estilos.rol}>
                        {u.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                      </Text>
                    </View>
                    {elegido?.id === u.id && (
                      <MaterialCommunityIcons name="check-circle" size={22} color={tema.colors.primary} />
                    )}
                  </View>
                </TouchableRipple>
              ))}

              {elegido && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <TextInput
                    label="PIN"
                    value={pin}
                    onChangeText={(t) => { setPin(t.replace(/[^0-9]/g, '')); setError(''); }}
                    mode="outlined"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    autoFocus
                  />
                  {!!error && <HelperText type="error" visible>{error}</HelperText>}
                  <Button mode="contained" icon="login" onPress={entrar}>
                    Entrar
                  </Button>
                </View>
              )}

              <Button
                compact
                icon="sync"
                onPress={sincronizarAhora}
                loading={sincronizando}
                disabled={sincronizando}
                style={{ marginTop: 8 }}
              >
                Actualizar usuarios
              </Button>
            </Card.Content>
          </Card>
        )}

        <Button compact onPress={() => setConfigVisible(true)} style={{ marginTop: 4 }}>
          Configurar servidor
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={configVisible} onDismiss={() => setConfigVisible(false)}>
          <Dialog.Title>Servidor</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Dirección del servidor"
              value={url}
              onChangeText={setUrl}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.38:8124"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfigVisible(false)}>Cancelar</Button>
            <Button
              mode="contained"
              onPress={async () => {
                await setServerUrl(url);
                setConfigVisible(false);
              }}
            >
              Guardar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingTop: 64, gap: 16 },
  marca: { alignItems: 'center', gap: 6, marginBottom: 8 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: tema.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { color: tema.colors.primary, fontWeight: '800' },
  subtitulo: { color: tema.colors.onSurfaceVariant },
  tarjeta: { backgroundColor: tema.colors.surfaceVariant },
  ayuda: { textAlign: 'center', color: tema.colors.onSurfaceVariant },
  usuario: { borderRadius: 12, padding: 4 },
  usuarioActivo: { backgroundColor: tema.colors.primaryContainer },
  usuarioFila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  rol: { color: tema.colors.onSurfaceVariant },
});
