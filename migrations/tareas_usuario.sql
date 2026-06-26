-- =====================================================
-- TAREAS_USUARIO — Tareas personales por usuario
-- =====================================================

CREATE TABLE IF NOT EXISTS tareas_usuario (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  institucion_id   UUID NOT NULL REFERENCES instituciones(id) ON DELETE CASCADE,
  texto            TEXT NOT NULL,
  fecha_vencimiento DATE,
  estado           TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada')),
  observacion      TEXT,
  -- Contexto escolar opcional
  contexto_tipo    TEXT CHECK (contexto_tipo IN ('alumno', 'problematica', 'general')),
  contexto_id      UUID,
  contexto_label   TEXT,
  creado_en        TIMESTAMPTZ DEFAULT now(),
  actualizado_en   TIMESTAMPTZ DEFAULT now()
);

-- RLS: cada usuario ve y gestiona solo sus propias tareas
ALTER TABLE tareas_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_sus_tareas" ON tareas_usuario
  FOR ALL USING (usuario_id = auth.uid());

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_tareas_usuario_id
  ON tareas_usuario(usuario_id, estado, fecha_vencimiento);
