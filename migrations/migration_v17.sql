-- ═══════════════════════════════════════════════════════
-- Migration v17: Fechas de ciclo lectivo y activación del sistema
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

ALTER TABLE instituciones
  ADD COLUMN IF NOT EXISTS fecha_inicio_ciclo date,
  ADD COLUMN IF NOT EXISTS fecha_fin_ciclo    date,
  ADD COLUMN IF NOT EXISTS fecha_activacion   timestamptz;

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v17 ──────────────────────────────
