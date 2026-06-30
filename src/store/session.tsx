import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Usuario } from '../db/types';
import { setVendedorId } from './ajustes';

const CLAVE_SESION = 'panaderia.sesion_usuario_id';

interface SesionContexto {
  usuario: Usuario | null;
  cargando: boolean;
  login: (usuario: Usuario) => Promise<void>;
  logout: () => Promise<void>;
  recargar: () => Promise<void>;
}

const Contexto = createContext<SesionContexto>({
  usuario: null,
  cargando: true,
  login: async () => {},
  logout: async () => {},
  recargar: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const id = await AsyncStorage.getItem(CLAVE_SESION);
    if (!id) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    const u = await db.getFirstAsync<Usuario>(
      'SELECT * FROM usuarios WHERE id = ? AND _deleted = 0', [id],
    );
    setUsuario(u ?? null);
    setCargando(false);
  }, [db]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const login = useCallback(async (u: Usuario) => {
    await AsyncStorage.setItem(CLAVE_SESION, u.id);
    await setVendedorId(u.id); // los pedidos/clientes nuevos se registran a su nombre
    setUsuario(u);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(CLAVE_SESION);
    setUsuario(null);
  }, []);

  return (
    <Contexto.Provider value={{ usuario, cargando, login, logout, recargar }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSession() {
  return useContext(Contexto);
}
