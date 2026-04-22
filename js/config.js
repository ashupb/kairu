// =====================================================
// EduGestión — Configuración
// =====================================================

const SUPABASE_URL     = 'https://vxsgzutluqfonhakiltz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4c2d6dXRsdXFmb25oYWtpbHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDYxNzYsImV4cCI6MjA5MTQyMjE3Nn0.SFGAg7XkO_FFVWj0ZoSN_16piibrl9CfJMyH_62gwtw';

// Service key para operaciones admin (crear usuarios en Auth)
// IMPORTANTE: usar solo en operaciones server-side controladas, nunca exponer al usuario final
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4c2d6dXRsdXFmb25oYWtpbHR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg0NjE3NiwiZXhwIjoyMDkxNDIyMTc2fQ.HoZTCTP2m41hjcdR4Nh4a5oiWWqmJfVxyxmXM29SaFE';

// Cliente Supabase — disponible globalmente como `sb`
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_CONFIG = {
  nombre:  'Kairu',
  version: '1.0.0-mvp',
};