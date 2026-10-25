/**
 * Adaptador de sesión MOVENTA → INVENTA.
 * Usar solo cuando ambos módulos compartan el MISMO cliente Supabase y origen.
 * No altera el almacenamiento de INVENTA existente ni introduce tokens en URLs.
 */
export function createInventaSessionAdapter(supabase, {onSession, onSignedOut, onError} = {}) {
  if (!supabase?.auth?.getSession || !supabase?.auth?.onAuthStateChange) {
    throw new TypeError('Se requiere un cliente supabase-js Auth v2');
  }
  let disposed = false;
  let sequence = 0;
  const emit = async (session, event) => {
    const current = ++sequence;
    try {
      // getUser valida identidad con Supabase antes de habilitar el módulo.
      if (!session) {
        if (!disposed && current === sequence) await onSignedOut?.(event);
        return;
      }
      const {data, error} = await supabase.auth.getUser();
      if (error) throw error;
      if (!disposed && current === sequence && data?.user?.id === session.user?.id) {
        await onSession?.({user: data.user, event});
      }
    } catch (error) {
      if (!disposed && current === sequence) await onError?.(error);
    }
  };
  const {data: {subscription}} = supabase.auth.onAuthStateChange((event, session) => {
    // Diferir operaciones async para evitar bloquear el callback de Auth.
    setTimeout(() => { if (!disposed) void emit(session, event); }, 0);
  });
  const ready = supabase.auth.getSession().then(({data, error}) => {
    if (error) throw error;
    return emit(data.session, 'INITIAL_SESSION');
  }).catch(async error => { if (!disposed) await onError?.(error); });
  return {ready, dispose() { disposed = true; sequence++; subscription.unsubscribe(); }};
}
