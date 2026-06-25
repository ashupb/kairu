// =====================================================
// EduGestión — Configuración
// =====================================================

// ── ENTORNO ──────────────────────────────────────────
// Para cambiar a STAGING: comentar las líneas PROD
// y descomentar las líneas STAGING.
// NUNCA commitear con staging activo en producción.

// PROD
const SUPABASE_URL      = 'https://vxsgzutluqfonhakiltz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_99GO4UBXXyv7NPAEs2JCkg__SkwuWbu';

// STAGING — completar con las keys del proyecto nuevo
// const SUPABASE_URL      = 'https://REEMPLAZAR.supabase.co';
// const SUPABASE_ANON_KEY = 'REEMPLAZAR_ANON_KEY';

// Cliente Supabase — disponible globalmente como `sb`
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_CONFIG = {
  nombre:  'Kairú',
  version: '1.0.0-mvp',
};