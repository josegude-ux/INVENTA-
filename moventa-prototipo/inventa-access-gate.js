import {aplicacionesPermitidas} from './app-access.js';

/**
 * Puerta de acceso al módulo INVENTA para el contenedor MOVENTA.
 * La autorización de MOVENTA es adicional: INVENTA debe seguir
 * verificando sus propios roles, RLS y permisos de operaciones.
 */
export function createInventaAccessGate(supabase, {onAllowed, onDenied, onError} = {}) {
  let revision = 0;
  let disposed = false;
  async function verify(user) {
    const current = ++revision;
    if (!user?.id) {
      if (!disposed) await onDenied?.('no-session');
      return false;
    }
    try {
      const {data: {user: authenticatedUser} = {}, error: authError} = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authenticatedUser || authenticatedUser.id !== user.id) {
        if (!disposed && current === revision) await onDenied?.('identity-mismatch');
        return false;
      }
      const apps = await aplicacionesPermitidas(supabase);
      if (disposed || current !== revision) return false;
      const allowed = apps.some(row => row.app_id === 'inventa');
      if (allowed) await onAllowed?.(user);
      else await onDenied?.('no-permission');
      return allowed;
    } catch (error) {
      if (!disposed && current === revision) await onError?.(error);
      return false; // nunca permitir acceso cuando falla la consulta
    }
  }
  async function deny(reason = 'signed-out') {
    ++revision; // invalida verificaciones pendientes
    if (!disposed) await onDenied?.(reason);
  }
  return {verify, deny, dispose() {disposed = true; ++revision;}};
}
