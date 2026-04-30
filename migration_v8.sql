-- =====================================================
-- MIGRATION V8 — Tipos de instancia evaluativa
-- =====================================================

-- 1. Tabla tipos_instancia_evaluativa
CREATE TABLE IF NOT EXISTS tipos_instancia_evaluativa (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id UUID REFERENCES instituciones(id) ON DELETE CASCADE NOT NULL,
  nombre         TEXT NOT NULL,
  orden          INTEGER DEFAULT 0,
  activo         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE tipos_instancia_evaluativa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tie_select" ON tipos_instancia_evaluativa FOR SELECT
  USING (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "tie_insert" ON tipos_instancia_evaluativa FOR INSERT
  WITH CHECK (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "tie_update" ON tipos_instancia_evaluativa FOR UPDATE
  USING (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "tie_delete" ON tipos_instancia_evaluativa FOR DELETE
  USING (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

-- =====================================================
-- EJECUTAR EN: Supabase → SQL Editor
-- Los valores por defecto por institución se insertan
-- automáticamente desde la app al abrir Parámetros.
-- =====================================================
