-- ═══════════════════════════════════════════════════════
-- Migration v9: RLS Problemáticas + Schema mejoras
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── 1. NORMALIZAR ESTADO 'resuelta' → 'cerrada' ─────
UPDATE problematicas
SET estado = 'cerrada'
WHERE estado = 'resuelta';

-- Verificar que no queden estados incorrectos:
-- SELECT DISTINCT estado FROM problematicas;

-- ─── 2. RLS EN problematicas ──────────────────────────
ALTER TABLE problematicas ENABLE ROW LEVEL SECURITY;

-- Director general: acceso total a su institución
CREATE POLICY prob_director_general ON problematicas
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'director_general')
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'director_general')
);

-- Directivo de nivel: problemáticas de su nivel o sin nivel asignado
CREATE POLICY prob_directivo_nivel ON problematicas
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'directivo_nivel')
  AND (
    nivel = (SELECT nivel FROM usuarios WHERE id = auth.uid())
    OR nivel IS NULL
  )
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'directivo_nivel')
);

-- EOE: acceso a todas las de su institución
CREATE POLICY prob_eoe ON problematicas
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'eoe')
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'eoe')
);

-- Preceptor: las que creó + donde es responsable + alumnos de sus cursos
CREATE POLICY prob_preceptor ON problematicas
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'preceptor')
  AND (
    registrado_por = auth.uid()
    OR responsable_id = auth.uid()
    OR alumno_id IN (
      SELECT a.id FROM alumnos a
      INNER JOIN asignaciones asig ON asig.curso_id = a.curso_id
      WHERE asig.docente_id = auth.uid() AND a.activo = true
    )
  )
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'preceptor')
);

-- Docente: solo las que él mismo creó
CREATE POLICY prob_docente ON problematicas
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND registrado_por = auth.uid()
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'docente')
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  AND registrado_por = auth.uid()
  AND EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'docente')
);

-- ─── 3. RLS EN intervenciones ─────────────────────────
ALTER TABLE intervenciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY interv_acceso ON intervenciones
FOR ALL TO authenticated
USING (
  problematica_id IN (
    SELECT id FROM problematicas
    WHERE institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  )
)
WITH CHECK (
  problematica_id IN (
    SELECT id FROM problematicas
    WHERE institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  )
);

-- ─── 4. RLS EN problematica_alumnos ───────────────────
ALTER TABLE problematica_alumnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY prob_alumnos_acceso ON problematica_alumnos
FOR ALL TO authenticated
USING (
  problematica_id IN (
    SELECT id FROM problematicas
    WHERE institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  )
)
WITH CHECK (
  problematica_id IN (
    SELECT id FROM problematicas
    WHERE institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
  )
);

-- ─── 5. CAMPO resultado EN intervenciones ─────────────
ALTER TABLE intervenciones
ADD COLUMN IF NOT EXISTS resultado TEXT
CHECK (resultado IN ('mejoro', 'sin_cambios', 'empeoro'));

-- ─── 6. TABLA tipos_problematicas ─────────────────────
CREATE TABLE IF NOT EXISTS tipos_problematicas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id UUID REFERENCES instituciones(id) ON DELETE CASCADE NOT NULL,
  nombre         TEXT NOT NULL,
  activo         BOOLEAN DEFAULT TRUE,
  orden          INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tipos_problematicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipos_prob_acceso ON tipos_problematicas
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
);

-- Sembrar tipos por defecto para instituciones existentes (solo si no tienen)
INSERT INTO tipos_problematicas (institucion_id, nombre, orden)
SELECT inst.id, tipos.nombre, tipos.orden
FROM instituciones inst
CROSS JOIN (VALUES
  ('Académica',      1),
  ('Conductual',     2),
  ('Familiar',       3),
  ('Ausentismo',     4),
  ('Socioemocional', 5),
  ('Salud',          6),
  ('Convivencia',    7),
  ('Otros',          8)
) AS tipos(nombre, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM tipos_problematicas tp WHERE tp.institucion_id = inst.id
);

-- ─── 7. TABLA tipos_intervencion ──────────────────────
CREATE TABLE IF NOT EXISTS tipos_intervencion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id UUID REFERENCES instituciones(id) ON DELETE CASCADE NOT NULL,
  nombre         TEXT NOT NULL,
  activo         BOOLEAN DEFAULT TRUE,
  orden          INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tipos_intervencion ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipos_interv_acceso ON tipos_intervencion
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
);

-- Sembrar tipos por defecto para instituciones existentes (solo si no tienen)
INSERT INTO tipos_intervencion (institucion_id, nombre, orden)
SELECT inst.id, tipos.nombre, tipos.orden
FROM instituciones inst
CROSS JOIN (VALUES
  ('Reunión con familia',    1),
  ('Reunión interna',        2),
  ('Derivación EOE',         3),
  ('Derivación externa',     4),
  ('Acuerdo de convivencia', 5),
  ('Seguimiento pedagógico', 6),
  ('Observación',            7),
  ('Otros',                  8)
) AS tipos(nombre, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM tipos_intervencion ti WHERE ti.institucion_id = inst.id
);
