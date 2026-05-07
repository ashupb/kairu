-- ═══════════════════════════════════════════════════════
-- Migration v16: Columnas faltantes en materias_estado_alumno
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Si materias_estado_alumno existía antes de v15 (sin curso_id),
-- el CREATE TABLE IF NOT EXISTS no agrega las columnas nuevas.
-- Esta migración las agrega de forma segura.

ALTER TABLE materias_estado_alumno
  ADD COLUMN IF NOT EXISTS curso_id              uuid REFERENCES cursos(id),
  ADD COLUMN IF NOT EXISTS institucion_id        uuid REFERENCES instituciones(id),
  ADD COLUMN IF NOT EXISTS ciclo_lectivo_origen  integer,
  ADD COLUMN IF NOT EXISTS ciclo_lectivo_cursado integer,
  ADD COLUMN IF NOT EXISTS nota_final            numeric(4,2),
  ADD COLUMN IF NOT EXISTS nota_intensif_1       numeric(4,2),
  ADD COLUMN IF NOT EXISTS nota_intensif_2       numeric(4,2),
  ADD COLUMN IF NOT EXISTS periodo_id            uuid REFERENCES periodos_intensificacion(id);

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v16 ──────────────────────────────
