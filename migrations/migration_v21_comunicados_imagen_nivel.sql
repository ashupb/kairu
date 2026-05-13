-- ═══════════════════════════════════════════════════════════════
-- Migration v21: Agregar imagen_url y nivel a comunicados
--
-- imagen_url: URL de imagen opcional en Supabase Storage
-- nivel:      filtro de nivel educativo para comunicados
--             institucionales ('inicial', 'primario', 'secundario').
--             NULL = visible para todos los niveles de la institución.
--
-- Ejecutar en Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columnas
ALTER TABLE comunicados
  ADD COLUMN IF NOT EXISTS imagen_url text,
  ADD COLUMN IF NOT EXISTS nivel      text;

-- 2. Validar valores de nivel
ALTER TABLE comunicados
  ADD CONSTRAINT com_nivel_check
  CHECK (nivel IS NULL OR nivel IN ('inicial', 'primario', 'secundario'));

-- 3. Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v21 ──────────────────────────────────────────
