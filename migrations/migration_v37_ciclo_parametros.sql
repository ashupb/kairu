-- ═══════════════════════════════════════════════════════
-- Migration v37: Ciclo Lectivo (slim) + Parámetros académicos
--   · Activación del sistema por nivel (antes un solo valor institucional)
--   · Fecha de cierre programada por período evaluativo (contador de 15 días)
--   · Cierre de período ligado al período evaluativo real por nivel
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── 1. Activación del sistema por nivel ────────────────
-- Antes vivía en instituciones.fecha_activacion (un solo valor).
-- Ahora cada nivel se activa por separado; los contadores de asistencia y
-- las alertas por inasistencia de cada nivel empiezan a contar desde acá.
alter table config_asistencia
  add column if not exists fecha_activacion timestamptz;

-- ── 2. Fecha de cierre programada por período evaluativo ───
-- Distinta de fecha_fin (fin pedagógico del período): esta es la fecha en la
-- que se ejecuta el cierre administrativo. El contador del inicio avisa cuando
-- faltan <= 15 días para esta fecha.
alter table periodos_evaluativos
  add column if not exists fecha_cierre_programada date;

-- ── 3. Cierre de período ligado al período real ────────
-- La BD viva usa cierres_periodo.tipo (text: 'cuatrimestre_1'/'cuatrimestre_2').
-- Se mantiene por compatibilidad y se agrega la referencia al período real y
-- el nivel, para poder cerrar el período configurado de cada nivel por separado.
alter table cierres_periodo
  add column if not exists tipo                 text,
  add column if not exists nivel                text,
  add column if not exists periodo_evaluativo_id uuid references periodos_evaluativos(id) on delete set null;

-- ── 4. Migrar el valor actual de activación a los 3 niveles ───
-- Copia instituciones.fecha_activacion a cada fila existente de
-- config_asistencia (una por nivel) que todavía no tenga activación propia.
update config_asistencia ca
   set fecha_activacion = i.fecha_activacion
  from instituciones i
 where ca.institucion_id = i.id
   and i.fecha_activacion is not null
   and ca.fecha_activacion is null;

-- Recargar schema cache de PostgREST
notify pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v37 ──────────────────────────────
