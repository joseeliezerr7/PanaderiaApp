import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_URL = 'panaderia.server_url';
const CLAVE_VENDEDOR = 'panaderia.vendedor_id';

export const URL_POR_DEFECTO = 'http://192.168.1.38:8124';

export async function getServerUrl(): Promise<string> {
  return (await AsyncStorage.getItem(CLAVE_URL)) ?? URL_POR_DEFECTO;
}

export async function setServerUrl(url: string) {
  await AsyncStorage.setItem(CLAVE_URL, url.trim());
}

export async function getVendedorId(): Promise<string | null> {
  return AsyncStorage.getItem(CLAVE_VENDEDOR);
}

export async function setVendedorId(id: string) {
  await AsyncStorage.setItem(CLAVE_VENDEDOR, id);
}

export interface Empresa {
  nombre: string;
  telefono: string;
  direccion: string;
  rtn: string;
}

const CLAVE_EMPRESA = 'panaderia.empresa';

export const EMPRESA_POR_DEFECTO: Empresa = {
  nombre: 'Panadería',
  telefono: '',
  direccion: '',
  rtn: '',
};

export async function getEmpresa(): Promise<Empresa> {
  const crudo = await AsyncStorage.getItem(CLAVE_EMPRESA);
  return crudo ? { ...EMPRESA_POR_DEFECTO, ...JSON.parse(crudo) } : EMPRESA_POR_DEFECTO;
}

export async function setEmpresa(e: Empresa) {
  await AsyncStorage.setItem(CLAVE_EMPRESA, JSON.stringify(e));
}
