/**
 * Copy to config.local.js (gitignored) when an INVENTA Supabase project exists.
 * Never put service_role here. Only URL + anon/public key.
 */
window.INVENTA_CONFIG = {
  supabaseUrl: '', // e.g. https://xxxx.supabase.co
  supabaseAnonKey: '',
  enabled: false,
};
