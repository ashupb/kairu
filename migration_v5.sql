-- =====================================================
-- Kairu · Migración v5
-- Soporte inicial y primario en config_asistencia
-- Ejecutar en Supabase → SQL Editor → New Query
-- Seguro de re-ejecutar (usa IF NOT EXISTS)
-- =====================================================

-- ── 1. NUEVAS COLUMNAS EN config_asistencia ──────────

-- Primario primer ciclo (1°-3°): escala conceptual
alter table config_asistencia add column if not exists escala_ciclo1     text default 'conceptual';
alter table config_asistencia add column if not exists aprobacion_ciclo1 text default 'B';

-- Primario segundo ciclo (4°-6°) y secundario: nota de recuperación
alter table config_asistencia add column if not exists nota_recuperacion int default 4;

-- Inicial: dimensiones de desarrollo para informes narrativos
alter table config_asistencia add column if not exists dimensiones_informe jsonb;

-- Valores por defecto para escala_ciclo1 en filas de primario ya existentes
update config_asistencia
   set escala_ciclo1 = 'conceptual', aprobacion_ciclo1 = 'B', nota_recuperacion = 4
 where nivel = 'primario' and escala_ciclo1 is null;

-- ── 2. COLUMNAS FALTANTES EN instituciones ────────────
-- (seguro si ya existen — pueden venir de setup previo)
alter table instituciones add column if not exists nivel_inicial    boolean default false;
alter table instituciones add column if not exists nivel_primario   boolean default false;
alter table instituciones add column if not exists nivel_secundario boolean default true;
alter table instituciones add column if not exists anio_lectivo     int;
alter table instituciones add column if not exists direccion        text;
alter table instituciones add column if not exists telefono         text;
alter table instituciones add column if not exists email_institucional text;

-- ── 3. RECARGAR SCHEMA CACHE ─────────────────────────
notify pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN ──────────────────────────────────
