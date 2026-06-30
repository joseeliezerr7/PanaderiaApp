import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { esAdmin, useUsuarioActivo } from '../../hooks/useUsuarioActivo';
import { tema } from '../../tema';

export default function TabsLayout() {
  const usuario = useUsuarioActivo();
  const admin = esAdmin(usuario);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tema.colors.primary,
        tabBarInactiveTintColor: tema.colors.outline,
        tabBarStyle: { backgroundColor: tema.colors.surface },
        headerStyle: { backgroundColor: tema.colors.surface },
        headerTintColor: tema.colors.primary,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="truck-delivery" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="storefront" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="productos"
        options={{
          title: 'Productos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bread-slice" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          // oculto para vendedores; visible solo en modo administrador
          href: admin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
