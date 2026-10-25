/** MOVENTA: controla el ciclo de vida de un módulo integrado. Sin tokens en URL. */
export function createModuleController({authorize, mount, unmount, onState = () => {}}) {
  if (typeof authorize !== 'function' || typeof mount !== 'function' || typeof unmount !== 'function')
    throw new TypeError('authorize, mount y unmount son obligatorios');
  let revision = 0;
  let active = false;
  let disposed = false;
  const state = (value) => { if (!disposed) onState(value); };
  async function close(reason = 'closed') {
    ++revision;
    active = false;
    try { await unmount(); } finally { state(reason); }
  }
  async function open(user, appId) {
    const current = ++revision;
    active = false;
    await unmount();
    if (disposed || current !== revision) return false;
    if (!user?.id || !['inventa', 'kontrola'].includes(appId)) { state('denied'); return false; }
    try {
      const allowed = await authorize(user, appId);
      if (disposed || current !== revision) return false;
      if (allowed !== true) { state('denied'); return false; }
      await mount({user, appId});
      if (disposed || current !== revision) { await unmount(); return false; }
      active = true;
      state('active');
      return true;
    } catch (_) {
      if (current === revision && !disposed) {
        active = false;
        await unmount();
        state('error');
      }
      return false;
    }
  }
  return {
    open, close,
    get active() { return active && !disposed; },
    async dispose() { ++revision; disposed = true; active = false; await unmount(); }
  };
}
