-- ═══════════════════════════════════════════════════════
-- Migration v12: Limpiar duplicados en tabla asistencia
--               y agregar constraint NULLS NOT DISTINCT
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── CONTEXTO ────────────────────────────────────────
-- El UNIQUE constraint estándar de PostgreSQL trata NULL != NULL,
-- por lo que filas con hora_clase=NULL y materia_id=NULL nunca
-- colisionan y upsert siempre inserta duplicados.
-- Esta migración:
--   1. Elimina los duplicados dejando el registro más reciente.
--   2. Crea un índice único con NULLS NOT DISTINCT para que
--      el constraint funcione correctamente con valores NULL.
-- ─────────────────────────────────────────────────────

-- ── 1. ELIMINAR DUPLICADOS ────────────────────────────
-- Para cada (alumno_id, fecha, hora_clase, materia_id)
-- conservar solo el registro con created_at más reciente.
DELETE FROM asistencia
WHERE id NOT IN (
  SELECT DISTINCT ON (
    alumno_id,
    fecha,
    COALESCE(hora_clase::text, ''),
    COALESCE(materia_id::text, '')
  )
    id
  FROM asistencia
  ORDER BY
    alumno_id,
    fecha,
    COALESCE(hora_clase::text, ''),
    COALESCE(materia_id::text, ''),
    created_at DESC NULLS LAST,
    id DESC
);

-- ── 2. DROP DEL ÍNDICE/CONSTRAINT ANTERIOR (si existe) ──
DROP INDEX IF EXISTS asistencia_alumno_fecha_hora_materia_idx;
DROP INDEX IF EXISTS asistencia_unico_idx;

-- Si hay un UNIQUE constraint de tabla, eliminarlo:
DO $$
DECLARE
  cname text;
BEGIN
  SELECT constraint_name INTO cname
  FROM information_schema.table_constraints
  WHERE table_schema   = 'public'
    AND table_name     = 'asistencia'
    AND constraint_type = 'UNIQUE'
    AND constraint_name NOT LIKE '%_pkey';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS %I', cname);
  END IF;
END $$;

-- ── 3. CREAR ÍNDICE ÚNICO CON NULLS NOT DISTINCT ────────
-- PostgreSQL 15+ (Supabase lo soporta).
-- NULLS NOT DISTINCT trata dos NULL como iguales en el constraint,
-- evitando que se inserten duplicados cuando hora_clase y materia_id son NULL.
CREATE UNIQUE INDEX IF NOT EXISTS asistencia_unico_idx
  ON asistencia (alumno_id, fecha, hora_clase, materia_id)
  NULLS NOT DISTINCT;

-- ── 4. RECARGAR SCHEMA CACHE ─────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v12 ──────────────────────────────
