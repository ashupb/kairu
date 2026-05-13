-- ═══════════════════════════════════════════════════════════════
-- Migration v20: Unificar tipos de instancia evaluativa
--
-- El modal de "Nueva instancia" leía de tipos_evaluacion (tabla
-- legacy vacía). La configuración gestiona tipos_instancia_evaluativa.
-- Esta migración corrige el FK de instancias_evaluativas para apuntar
-- a la tabla correcta.
--
-- Ejecutar en Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar es_recuperatorio a tipos_instancia_evaluativa
ALTER TABLE tipos_instancia_evaluativa
  ADD COLUMN IF NOT EXISTS es_recuperatorio boolean DEFAULT false;

-- 2. Corregir el FK de instancias_evaluativas.tipo_id
--    Antes apuntaba a tipos_evaluacion, ahora apunta a tipos_instancia_evaluativa.
--    Se usa el nombre de constraint convencional de PostgreSQL.
ALTER TABLE instancias_evaluativas
  DROP CONSTRAINT IF EXISTS instancias_evaluativas_tipo_id_fkey;

ALTER TABLE instancias_evaluativas
  ADD CONSTRAINT instancias_evaluativas_tipo_id_fkey
  FOREIGN KEY (tipo_id) REFERENCES tipos_instancia_evaluativa(id) ON DELETE SET NULL;

-- 3. Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v20 ──────────────────────────────────────────
