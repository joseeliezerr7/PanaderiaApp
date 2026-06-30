import type { Usuario } from '../db/types';
import { useSession } from '../store/session';

/**
 * Usuario con sesión activa. Define el modo de la app:
 *  - rol 'vendedor': ve su cartera de clientes y sus pedidos
 *  - rol 'admin':    ve todo y accede al panel administrativo
 */
export function useUsuarioActivo(): Usuario | null {
  return useSession().usuario;
}

export function esAdmin(u: Usuario | null): boolean {
  return u?.rol === 'admin';
}
