import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, PaperProvider, Text } from 'react-native-paper';
import { migrar } from '../db/database';
import { SessionProvider, useSession } from '../store/session';
import { sincronizarEnFondo, vigilarConexion } from '../sync/sync';
import { tema } from '../tema';

/** Pantalla amigable si una pantalla falla (en vez de pantalla en blanco). */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <PaperProvider theme={tema}>
      <View style={estilos.errorPantalla}>
        <MaterialCommunityIcons name="alert-circle-outline" size={56} color={tema.colors.error} />
        <Text variant="titleLarge" style={estilos.errorTitulo}>Ups, algo salió mal</Text>
        <Text variant="bodyMedium" style={estilos.errorTexto}>
          La información que guardaste en el teléfono está a salvo. Vuelve a intentarlo.
        </Text>
        <Button mode="contained" icon="refresh" onPress={() => retry()}>
          Reintentar
        </Button>
        <ScrollView style={estilos.errorDetalle}>
          <Text variant="bodySmall" style={{ color: tema.colors.onSurfaceVariant }}>
            {error?.message ?? String(error)}
          </Text>
        </ScrollView>
      </View>
    </PaperProvider>
  );
}

function SyncAutomatico({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();

  useEffect(() => {
    sincronizarEnFondo(db); // al abrir la app
    const parar = vigilarConexion(db); // al recuperar señal
    const intervalo = setInterval(() => sincronizarEnFondo(db), 5 * 60 * 1000);
    return () => {
      parar();
      clearInterval(intervalo);
    };
  }, [db]);

  return <>{children}</>;
}

/** Redirige a /login cuando no hay sesión, y fuera de /login cuando sí la hay. */
function GuardiaSesion({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    const enLogin = segments[0] === 'login';
    if (!usuario && !enLogin) router.replace('/login');
    else if (usuario && enLogin) router.replace('/(tabs)');
  }, [usuario, cargando, segments, router]);

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.colors.background }}>
        <ActivityIndicator size="large" color={tema.colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="panaderia.db" onInit={migrar}>
      <PaperProvider theme={tema}>
        <SessionProvider>
          <SyncAutomatico>
            <StatusBar style="dark" />
            <GuardiaSesion>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: tema.colors.surface },
                  headerTintColor: tema.colors.primary,
                  headerTitleStyle: { fontWeight: '700' },
                  contentStyle: { backgroundColor: tema.colors.background },
                }}
              >
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="cliente/[id]" options={{ title: 'Cliente' }} />
                <Stack.Screen name="cliente/nuevo" options={{ title: 'Nuevo cliente' }} />
                <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
                <Stack.Screen name="ticket/[id]" options={{ title: 'Ticket' }} />
                <Stack.Screen name="cierre" options={{ title: 'Cierre del día' }} />
                <Stack.Screen name="admin/negocio" options={{ title: 'Datos del negocio' }} />
                <Stack.Screen name="admin/precios" options={{ title: 'Productos y precios' }} />
                <Stack.Screen name="admin/panel" options={{ headerShown: false }} />
                <Stack.Screen name="elegir-cliente" options={{ title: '¿Para qué cliente?', presentation: 'modal' }} />
              </Stack>
            </GuardiaSesion>
          </SyncAutomatico>
        </SessionProvider>
      </PaperProvider>
    </SQLiteProvider>
  );
}

const estilos = StyleSheet.create({
  errorPantalla: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: tema.colors.background,
  },
  errorTitulo: { color: tema.colors.onSurface, fontWeight: '700' },
  errorTexto: { textAlign: 'center', color: tema.colors.onSurfaceVariant },
  errorDetalle: { maxHeight: 120, marginTop: 8, alignSelf: 'stretch' },
});
