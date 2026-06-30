import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { type Empresa, EMPRESA_POR_DEFECTO, getEmpresa, setEmpresa as guardar } from '../../store/ajustes';
import { tema } from '../../tema';

export default function DatosNegocio() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<Empresa>(EMPRESA_POR_DEFECTO);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    void getEmpresa().then(setEmpresa);
  }, []);

  const campo = (k: keyof Empresa) => (v: string) => {
    setEmpresa((e) => ({ ...e, [k]: v }));
    setGuardado(false);
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Datos del negocio' }} />
      <Text variant="bodyMedium" style={estilos.intro}>
        Esta información aparece en la cabecera de cada factura/ticket de entrega.
      </Text>

      <TextInput label="Nombre del negocio *" value={empresa.nombre} onChangeText={campo('nombre')} mode="outlined" />
      <TextInput label="Teléfono" value={empresa.telefono} onChangeText={campo('telefono')} mode="outlined" keyboardType="phone-pad" />
      <TextInput label="Dirección" value={empresa.direccion} onChangeText={campo('direccion')} mode="outlined" multiline />
      <TextInput label="RTN" value={empresa.rtn} onChangeText={campo('rtn')} mode="outlined" />
      <HelperText type="info">El RTN es opcional; déjalo vacío si no facturas con impuesto.</HelperText>

      <Button
        mode="contained"
        icon="content-save"
        onPress={async () => {
          await guardar(empresa);
          setGuardado(true);
          setTimeout(() => router.back(), 600);
        }}
        style={{ marginTop: 4 }}
      >
        Guardar
      </Button>
      {guardado && <Text style={estilos.ok}>✓ Guardado</Text>}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: 16, gap: 12 },
  intro: { color: tema.colors.onSurfaceVariant },
  ok: { textAlign: 'center', color: '#2E7D32' },
});
