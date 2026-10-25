/** Carga una aplicación ya compilada bajo el mismo origen de MOVENTA.
 * No carga enlaces externos ni transmite credenciales mediante URL.
 * El permiso se comprueba por separado antes de llamar a mount().
 */
export function createSameOriginModule({container, baseURL = location.href} = {}) {
  if (!container?.replaceChildren) throw new TypeError('Se requiere contenedor DOM');
  const base = new URL(baseURL);
  let frame = null;
  function mount({path, title}) {
    const target = new URL(path, base);
    if (target.origin !== base.origin) throw new Error('Módulo de origen externo bloqueado');
    if (target.username || target.password || target.search || target.hash)
      throw new Error('URL de módulo no permitida');
    if (!target.pathname.startsWith(new URL('./', base).pathname))
      throw new Error('Módulo fuera del ámbito MOVENTA');
    if (target.pathname === base.pathname) throw new Error('Ruta del lanzador no es un módulo');
    const next = container.ownerDocument.createElement('iframe');
    next.title = title || 'Módulo MOVENTA';
    next.src = target.href;
    next.setAttribute('referrerpolicy', 'same-origin');
    next.style.cssText = 'width:100%;min-height:65vh;border:0';
    container.replaceChildren(next);
    frame = next;
  }
  function unmount() { container.replaceChildren(); frame = null; }
  return {mount, unmount, get mounted() { return !!frame; }};
}
