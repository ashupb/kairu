-- ═══════════════════════════════════════════════════════
-- Migration v14: Suplencias y licencias
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Campo en_licencia en usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS en_licencia boolean DEFAULT false;

-- 2. Tabla suplencias
CREATE TABLE IF NOT EXISTS suplencias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id   uuid NOT NULL REFERENCES usuarios(id),
  suplente_id  uuid NOT NULL REFERENCES usuarios(id),
  fecha_inicio date NOT NULL,
  fecha_fin    date,          -- null = sin fecha de regreso definida
  activo       boolean DEFAULT true,
  notas        text,          -- motivo de licencia, opcional
  creado_por   uuid REFERENCES usuarios(id),
  created_at   timestamptz DEFAULT now()
);

-- 3. Campo suplencia_id en asignaciones
--    Permite identificar qué asignaciones son de suplencia y eliminarlas al finalizar
ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS suplencia_id uuid REFERENCES suplencias(id);

-- Recargar schema cache
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v14 ──────────────────────────────
