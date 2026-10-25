export async function aplicacionesPermitidas(supabase) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return [];
  const { data, error } = await supabase.from('moventa_app_access')
    .select('app_id,app_role').eq('user_id', user.id).eq('enabled', true);
  if (error) throw error;
  return data ?? [];
}
// Las reglas de seguridad de cada aplicación siguen siendo obligatorias.
