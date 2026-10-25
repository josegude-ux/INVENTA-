/**
 * MOVENTA: comprobaciones previas a la federación.
 * Este módulo NO intercambia tokens ni inicia sesión en otros proyectos.
 */
export const AUTH_PROJECTS = Object.freeze({
  moventa: 'wlejxnpphysogrzcxjfh',
  inventa: 'wlejxnpphysogrzcxjfh',
  kontrola: 'oevetnszmfxeukcncwji'
});
export function puedeReutilizarSesion(origen, destino) {
  if (!(origen in AUTH_PROJECTS) || !(destino in AUTH_PROJECTS)) return false;
  return AUTH_PROJECTS[origen] === AUTH_PROJECTS[destino];
}
export function estadoIntegracion(appId, permisos = []) {
  if (!['inventa', 'kontrola'].includes(appId)) return { visible: false, sesionCompartida: false };
  const autorizado = permisos.some(p => p.app_id === appId);
  return {
    visible: autorizado,
    // INVENTA tampoco está integrado todavía: tener el mismo backend no basta.
    sesionCompartida: false,
    requiereFederacion: autorizado && !puedeReutilizarSesion('moventa', appId)
  };
}
