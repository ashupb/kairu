-- ═══════════════════════════════════════════════════════════════
-- FIX: Recursión infinita en RLS de tabla alumnos
-- Causa: migration_v19_familias creó políticas que se referencian
--        mutuamente con alumnos → ciclo infinito.
-- Ejecutar en Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 1: VER políticas actuales (diagnóstico, opcional) ───
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'alumnos';

-- ── PASO 2: Eliminar TODAS las políticas actuales de alumnos ──
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'alumnos' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON alumnos', pol.policyname);
  END LOOP;
END $$;

-- ── PASO 3: Recrear la política correcta (sin recursión) ──────
-- Acceso por institución: subquery sobre usuarios (no sobre alumnos).
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alumnos_inst" ON alumnos
FOR ALL TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM usuarios WHERE id = auth.uid()
  )
)
WITH CHECK (
  institucion_id IN (
    SELECT institucion_id FROM usuarios WHERE id = auth.uid()
  )
);

-- ── PASO 4: Corregir RLS en tabla familia_alumnos (si existe) ─
-- La policy original era recursiva: alumnos → familia_alumnos → alumnos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'familia_alumnos'
  ) THEN
    DROP POLICY IF EXISTS "familia_alumnos_select"  ON familia_alumnos;
    DROP POLICY IF EXISTS "familia_alumnos_acceso"  ON familia_alumnos;
    DROP POLICY IF EXISTS "familia_alumnos_inst"    ON familia_alumnos;

    -- Recrear sin subquery a alumnos: el staff accede vía cursos/institución
    EXECUTE $pol$
      CREATE POLICY "familia_alumnos_acceso" ON familia_alumnos
      FOR ALL TO authenticated
      USING (
        familia_id IN (
          SELECT id FROM familias WHERE usuario_id = auth.uid()
        )
        OR
        familia_id IN (
          SELECT fa.id FROM familias fa
          WHERE fa.institucion_id IN (
            SELECT institucion_id FROM usuarios WHERE id = auth.uid()
          )
        )
      )
      WITH CHECK (
        familia_id IN (
          SELECT fa.id FROM familias fa
          WHERE fa.institucion_id IN (
            SELECT institucion_id FROM usuarios WHERE id = auth.uid()
          )
        )
      )
    $pol$;
  END IF;
END $$;

-- ── PASO 5: Corregir RLS en tabla familias (si existe) ────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'familias'
  ) THEN
    DROP POLICY IF EXISTS "familias_select"  ON familias;
    DROP POLICY IF EXISTS "familias_acceso"  ON familias;
    DROP POLICY IF EXISTS "familias_propia"  ON familias;

    EXECUTE $pol$
      CREATE POLICY "familias_acceso" ON familias
      FOR ALL TO authenticated
      USING (
        usuario_id = auth.uid()
        OR
        institucion_id IN (
          SELECT institucion_id FROM usuarios WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        institucion_id IN (
          SELECT institucion_id FROM usuarios WHERE id = auth.uid()
        )
      )
    $pol$;
  END IF;
END $$;

-- ── PASO 6: Recargar schema cache ────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DEL FIX ──────────────────────────────────────────────
