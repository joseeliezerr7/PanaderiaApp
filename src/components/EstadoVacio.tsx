import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { tema } from '../tema';

/** Estado vacío reutilizable: icono, mensaje y acción opcional. */
export function EstadoVacio({
  icono,
  titulo,
  detalle,
  accion,
}: {
  icono: any;
  titulo: string;
  detalle?: string;
  accion?: { etiqueta: string; icono?: string; onPress: () => void };
}) {
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.circulo}>
        <MaterialCommunityIcons name={icono} size={44} color={tema.colors.primary} />
      </View>
      <Text variant="titleMedium" style={estilos.titulo}>{titulo}</Text>
      {!!detalle && <Text variant="bodyMedium" style={estilos.detalle}>{detalle}</Text>}
      {accion && (
        <Button mode="contained-tonal" icon={accion.icono} onPress={accion.onPress} style={{ marginTop: 6 }}>
          {accion.etiqueta}
        </Button>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: 10, paddingHorizontal: 40, paddingTop: 60 },
  circulo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tema.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { textAlign: 'center', color: tema.colors.onSurface },
  detalle: { textAlign: 'center', color: tema.colors.onSurfaceVariant },
});
