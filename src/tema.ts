import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

/** Tema cálido de panadería sobre Material Design 3. */
export const tema: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#8B5E2B',          // marrón pan
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFDDB8',
    onPrimaryContainer: '#2E1B00',
    secondary: '#C77F2E',        // dorado horneado
    secondaryContainer: '#FFE6C7',
    onSecondaryContainer: '#3A2400',
    tertiary: '#4E6542',         // verde aceituna (acentos OK)
    background: '#FFF8F2',
    surface: '#FFF8F2',
    surfaceVariant: '#F2E1CF',
    onSurfaceVariant: '#51443A',
    outline: '#84746A',
    error: '#BA1A1A',
  },
};

export const colorEstado: Record<string, string> = {
  borrador: '#9E9E9E',
  enviado: '#1976D2',
  entregado: '#2E7D32',
  cancelado: '#BA1A1A',
};

export function formatoLempira(n: number): string {
  return `L ${n.toFixed(2)}`;
}

export function formatoFecha(iso: string): string {
  const f = iso.slice(0, 10);
  const [a, m, d] = f.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${meses[Number(m) - 1]} ${a}`;
}
