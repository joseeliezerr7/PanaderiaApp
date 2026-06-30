import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { getServerUrl } from '../../store/ajustes';
import { tema } from '../../tema';

/**
 * Panel administrativo de Laravel (Filament) embebido en la app.
 * Carga <servidor>/admin; el usuario inicia sesión con su correo y contraseña
 * del panel. Requiere conexión al servidor.
 */
export default function PanelWeb() {
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [puedeAtras, setPuedeAtras] = useState(false);

  useEffect(() => {
    void getServerUrl().then((base) => setUrl(`${base.replace(/\/+$/, '')}/admin`));
  }, []);

  if (!url) {
    return (
      <View style={estilos.centro}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={tema.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Appbar.Header style={{ backgroundColor: tema.colors.surface }}>
        <Appbar.BackAction onPress={() => (puedeAtras ? webRef.current?.goBack() : router.back())} />
        <Appbar.Content title="Panel administrativo" titleStyle={{ fontWeight: '700' }} />
        <Appbar.Action icon="refresh" onPress={() => webRef.current?.reload()} />
        <Appbar.Action icon="open-in-new" onPress={() => Linking.openURL(url)} />
      </Appbar.Header>

      {error ? (
        <View style={estilos.centro}>
          <MaterialCommunityIcons name="lan-disconnect" size={52} color={tema.colors.outline} />
          <Text variant="titleMedium" style={{ textAlign: 'center' }}>No se pudo abrir el panel</Text>
          <Text variant="bodyMedium" style={estilos.detalle}>
            Revisa que tengas conexión con el servidor de la panadería y que esté encendido.
          </Text>
          <Button mode="contained" icon="refresh" onPress={() => { setError(false); webRef.current?.reload(); }}>
            Reintentar
          </Button>
          <Button onPress={() => Linking.openURL(url)}>Abrir en el navegador</Button>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView
            ref={webRef}
            source={{ uri: url }}
            onLoadEnd={() => setCargando(false)}
            onError={() => { setError(true); setCargando(false); }}
            onHttpError={() => setCargando(false)}
            onNavigationStateChange={(s) => setPuedeAtras(s.canGoBack)}
            startInLoadingState
            domStorageEnabled
            javaScriptEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
          />
          {cargando && (
            <View style={estilos.overlay}>
              <ActivityIndicator size="large" color={tema.colors.primary} />
              <Text variant="bodySmall" style={estilos.detalle}>Cargando panel…</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  detalle: { textAlign: 'center', color: tema.colors.onSurfaceVariant },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tema.colors.background,
  },
});
