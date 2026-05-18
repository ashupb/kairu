-- ═══════════════════════════════════════════════════════════════
-- Migration v27: Agenda — citas individuales + RSVP familias
-- Aplicar manualmente en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Columnas nuevas en eventos_institucionales
ALTER TABLE eventos_institucionales
  ADD COLUMN IF NOT EXISTS cursos_familias_ids  UUID[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hora_fin             TIME     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS alumno_id            UUID     REFERENCES alumnos(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS problematica_id      UUID     REFERENCES problematicas(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS es_cita_individual   BOOLEAN  DEFAULT FALSE;

-- 2. Mensaje en evento_respuestas (propuesta de horario alternativo)
ALTER TABLE evento_respuestas
  ADD COLUMN IF NOT EXISTS mensaje TEXT DEFAULT NULL;

-- 3. Índice para búsqueda de citas por alumno
CREATE INDEX IF NOT EXISTS idx_eventos_alumno_id
  ON eventos_institucionales(alumno_id)
  WHERE alumno_id IS NOT NULL;

-- 4. RLS: familiares pueden insertar/actualizar su propia respuesta
--    (ejecutar solo si RLS está habilitado en evento_respuestas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'evento_respuestas' AND c.relrowsecurity = TRUE
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'evento_respuestas' AND policyname = 'familiar_rsvp_insert'
    ) THEN
      EXECUTE 'CREATE POLICY familiar_rsvp_insert ON evento_respuestas FOR INSERT WITH CHECK (auth.uid() = usuario_id)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'evento_respuestas' AND policyname = 'familiar_rsvp_update'
    ) THEN
      EXECUTE 'CREATE POLICY familiar_rsvp_update ON evento_respuestas FOR UPDATE USING (auth.uid() = usuario_id)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'evento_respuestas' AND policyname = 'familiar_rsvp_select'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY familiar_rsvp_select ON evento_respuestas FOR SELECT USING (
          auth.uid() = usuario_id
          OR EXISTS (
            SELECT 1 FROM eventos_institucionales e
            WHERE e.id = evento_id
              AND (
                e.creado_por = auth.uid()
                OR auth.uid() = ANY(COALESCE(e.convocados_ids, '{}'))
                OR auth.uid() = ANY(COALESCE(e.responsables_ids, '{}'))
              )
          )
        )
      $policy$;
    END IF;
  END IF;
END $$;

-- 5. Comentarios
COMMENT ON COLUMN eventos_institucionales.cursos_familias_ids IS 'NULL = todas las familias del nivel; con IDs = solo esas familias de esos cursos';
COMMENT ON COLUMN eventos_institucionales.hora_fin            IS 'Hora de fin para eventos con rango horario';
COMMENT ON COLUMN eventos_institucionales.alumno_id           IS 'Citas individuales: alumno convocado';
COMMENT ON COLUMN eventos_institucionales.problematica_id     IS 'Citas individuales: problemática asociada (opcional)';
COMMENT ON COLUMN eventos_institucionales.es_cita_individual  IS 'TRUE = cita individual para familia; FALSE = evento colectivo';
COMMENT ON COLUMN evento_respuestas.mensaje                   IS 'Mensaje adicional o propuesta de horario alternativo';
