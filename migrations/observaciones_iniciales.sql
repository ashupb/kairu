-- =====================================================
-- Kairu · Migración — Módulo Nivel Inicial
-- Tablas: observaciones_iniciales, informes_iniciales
-- Ejecutar en Supabase → SQL Editor → New Query
-- Seguro de re-ejecutar (usa IF NOT EXISTS / CREATE OR REPLACE)
-- =====================================================

-- ── 1. TABLA observaciones_iniciales ─────────────────
-- Observaciones narrativas por dimensión de desarrollo,
-- por alumno y semestre.

CREATE TABLE IF NOT EXISTS observaciones_iniciales (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id       UUID        NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  institucion_id  UUID        NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
  anio_lectivo    INT         NOT NULL,
  semestre        INT         NOT NULL CHECK (semestre IN (1, 2)),
  dimension       TEXT        NOT NULL,
  observacion     TEXT,
  borrador_ia     TEXT,
  creado_por      UUID        REFERENCES usuarios(id),
  actualizado_en  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (alumno_id, anio_lectivo, semestre, dimension)
);

-- ── 2. TABLA informes_iniciales ───────────────────────
-- Informe narrativo final compilado por alumno y semestre.

CREATE TABLE IF NOT EXISTS informes_iniciales (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id       UUID        NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  institucion_id  UUID        NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
  anio_lectivo    INT         NOT NULL,
  semestre        INT         NOT NULL CHECK (semestre IN (1, 2)),
  texto_final     TEXT,
  borrador_ia     TEXT,
  estado          TEXT        NOT NULL DEFAULT 'borrador'
                              CHECK (estado IN ('borrador', 'finalizado', 'enviado')),
  creado_por      UUID        REFERENCES usuarios(id),
  actualizado_en  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (alumno_id, anio_lectivo, semestre)
);

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────

ALTER TABLE observaciones_iniciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes_iniciales      ENABLE ROW LEVEL SECURITY;

-- observaciones_iniciales: docentes, directivos y EOE de la misma institución

DROP POLICY IF EXISTS "obs_ini_docente"    ON observaciones_iniciales;
DROP POLICY IF EXISTS "obs_ini_directivo"  ON observaciones_iniciales;
DROP POLICY IF EXISTS "obs_ini_eoe"        ON observaciones_iniciales;

-- Docente: puede insertar y actualizar observaciones de alumnos de sus cursos
CREATE POLICY "obs_ini_docente" ON observaciones_iniciales
  FOR ALL
  USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'docente'
    )
    AND alumno_id IN (
      SELECT al.id FROM alumnos al
      JOIN asignaciones asi ON asi.curso_id = al.curso_id
      WHERE asi.docente_id = auth.uid()
        AND asi.anio_lectivo = anio_lectivo
    )
  )
  WITH CHECK (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'docente'
    )
  );

-- Directivos y director general: acceso completo en su institución
CREATE POLICY "obs_ini_directivo" ON observaciones_iniciales
  FOR ALL
  USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('director_general', 'directivo_nivel')
    )
  )
  WITH CHECK (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  );

-- EOE: solo lectura
CREATE POLICY "obs_ini_eoe" ON observaciones_iniciales
  FOR SELECT
  USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'eoe'
    )
  );

-- informes_iniciales: mismas políticas

DROP POLICY IF EXISTS "inf_ini_docente"   ON informes_iniciales;
DROP POLICY IF EXISTS "inf_ini_directivo" ON informes_iniciales;
DROP POLICY IF EXISTS "inf_ini_eoe"       ON informes_iniciales;

CREATE POLICY "inf_ini_docente" ON informes_iniciales
  FOR ALL
  USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'docente'
    )
    AND alumno_id IN (
      SELECT al.id FROM alumnos al
      JOIN asignaciones asi ON asi.curso_id = al.curso_id
      WHERE asi.docente_id = auth.uid()
        AND asi.anio_lectivo = anio_lectivo
    )
  )
  WITH CHECK (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'docente'
    )
  );

CREATE POLICY "inf_ini_directivo" ON informes_iniciales
  FOR ALL
  USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('director_general', 'directivo_nivel')
    )
  )
  WITH CHECK (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "inf_ini_eoe" ON informes_iniciales
  FOR SELECT
  USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'eoe'
    )
  );

-- ── 4. RECARGAR SCHEMA CACHE ──────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN ──────────────────────────────────
