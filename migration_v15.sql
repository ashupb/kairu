-- ═══════════════════════════════════════════════════════
-- Migration v15: Trayectorias y períodos de intensificación
-- Resolución 1650/2024 - Provincia de Buenos Aires
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Tabla periodos_intensificacion
--    Define los 4 períodos de intensificación por ciclo lectivo
CREATE TABLE IF NOT EXISTS periodos_intensificacion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES instituciones(id),
  ciclo_lectivo  integer NOT NULL,
  nombre         text NOT NULL,
  tipo           text NOT NULL CHECK (tipo IN ('inicio_c1','fin_c1','diciembre','febrero')),
  fecha_inicio   date NOT NULL,
  fecha_fin      date NOT NULL,
  activo         boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

-- 2. Tabla materias_estado_alumno
--    Estado de cada materia por alumno, con trayecto histórico
CREATE TABLE IF NOT EXISTS materias_estado_alumno (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id             uuid NOT NULL REFERENCES alumnos(id),
  materia_id            uuid NOT NULL REFERENCES materias(id),
  curso_id              uuid NOT NULL REFERENCES cursos(id),
  institucion_id        uuid REFERENCES instituciones(id),
  ciclo_lectivo_origen  integer NOT NULL,  -- año al que pertenece la materia
  ciclo_lectivo_cursado integer NOT NULL,  -- año en que se está resolviendo
  estado                text NOT NULL DEFAULT 'cursando'
    CHECK (estado IN (
      'cursando','aprobada','desaprobada',
      'pendiente_intensif','intensificando','recursando','a_recursar'
    )),
  nota_final      numeric(4,2),
  nota_intensif_1 numeric(4,2),
  nota_intensif_2 numeric(4,2),
  periodo_id      uuid REFERENCES periodos_intensificacion(id),
  created_at      timestamptz DEFAULT now()
);

-- 3. Nuevas columnas en alertas_academicas
--    La tabla ya existe con columnas viejas (tipo_alerta, materia_id, detalle, etc.)
--    Solo se agregan las nuevas columnas — las viejas no se borran
ALTER TABLE alertas_academicas
  ADD COLUMN IF NOT EXISTS alumno_id     uuid REFERENCES alumnos(id),
  ADD COLUMN IF NOT EXISTS tipo          text,
  ADD COLUMN IF NOT EXISTS materias_ids  uuid[],
  ADD COLUMN IF NOT EXISTS ciclo_lectivo integer,
  ADD COLUMN IF NOT EXISTS cuatrimestre  integer,
  ADD COLUMN IF NOT EXISTS leida         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS resuelta      boolean DEFAULT false;

-- 4. Tabla cierres_periodo
--    Registro del acto de cierre de cuatrimestre o año
CREATE TABLE IF NOT EXISTS cierres_periodo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid REFERENCES instituciones(id),
  ciclo_lectivo  integer NOT NULL,
  cuatrimestre   integer NOT NULL,  -- 1 o 2; 0 = cierre anual
  cerrado_por    uuid REFERENCES usuarios(id),
  created_at     timestamptz DEFAULT now()
);

-- 5. Nuevas columnas en asistencia
ALTER TABLE asistencia
  ADD COLUMN IF NOT EXISTS periodo_intensif_id uuid REFERENCES periodos_intensificacion(id),
  ADD COLUMN IF NOT EXISTS materia_estado_id   uuid REFERENCES materias_estado_alumno(id);

-- Recargar schema cache
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v15 ──────────────────────────────
