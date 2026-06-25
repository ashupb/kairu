-- ══════════════════════════════════════════════════════════════════
-- Migration v33: fix check constraint nivel en eventos_institucionales
--
-- El constraint original solo aceptaba valores simples ('todos', 'inicial',
-- 'primario', 'secundario'). La UI del director general permite seleccionar
-- múltiples niveles → genera strings como 'inicial,primario'.
-- Este fix reemplaza el constraint para aceptar esas combinaciones.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE eventos_institucionales
DROP CONSTRAINT IF EXISTS eventos_institucionales_nivel_check;

ALTER TABLE eventos_institucionales
ADD CONSTRAINT eventos_institucionales_nivel_check
CHECK (
  nivel IS NULL
  OR nivel = 'todos'
  OR nivel ~ '^(inicial|primario|secundario)(,(inicial|primario|secundario))*$'
);
