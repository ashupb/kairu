-- =====================================================
-- EduGestión · Migración v3
-- Ejecutar en Supabase → SQL Editor → New Query
-- Seguro de re-ejecutar
-- =====================================================

-- ── 1. RLS PARA TABLA asignaciones ───────────────────
-- La tabla no tiene institucion_id — la verificación
-- se hace via curso_id → cursos.institucion_id

alter table asignaciones enable row level security;

drop policy if exists "asignaciones_via_curso" on asignaciones;
create policy "asignaciones_via_curso" on asignaciones
  for all using (
    curso_id in (
      select c.id from cursos c
      join usuarios u on u.institucion_id = c.institucion_id
      where u.id = auth.uid()
    )
  ) with check (
    curso_id in (
      select c.id from cursos c
      join usuarios u on u.institucion_id = c.institucion_id
      where u.id = auth.uid()
    )
  );

-- ── 2. TABLAS DE PARÁMETROS (crear si no existen) ────

create table if not exists config_asistencia (
  id                   uuid primary key default gen_random_uuid(),
  institucion_id       uuid references instituciones(id) on delete cascade,
  nivel                text not null,
  umbral_alerta_1      int  default 10,
  umbral_alerta_2      int  default 20,
  umbral_alerta_3      int  default 30,
  justificadas_cuentan boolean default false,
  nota_minima          int  default 7,
  escala               text default 'numerica',
  created_at           timestamptz default now(),
  unique (institucion_id, nivel)
);

create table if not exists tipos_evaluacion (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  activo         boolean default true,
  created_at     timestamptz default now()
);

create table if not exists tipos_justificacion (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  activo         boolean default true,
  created_at     timestamptz default now()
);

create table if not exists tipos_evento (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  activo         boolean default true,
  created_at     timestamptz default now()
);

create table if not exists periodos_evaluativos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  activo         boolean default true,
  created_at     timestamptz default now()
);

-- Agregar columnas faltantes (seguro si ya existen)
alter table tipos_evaluacion    add column if not exists nivel          text;
alter table tipos_evaluacion    add column if not exists institucion_id uuid references instituciones(id) on delete cascade;
alter table tipos_justificacion add column if not exists nivel          text;
alter table tipos_justificacion add column if not exists institucion_id uuid references instituciones(id) on delete cascade;
alter table tipos_evento        add column if not exists institucion_id uuid references instituciones(id) on delete cascade;
alter table periodos_evaluativos add column if not exists nivel         text;
alter table periodos_evaluativos add column if not exists institucion_id uuid references instituciones(id) on delete cascade;
alter table periodos_evaluativos add column if not exists anio          int;
alter table periodos_evaluativos add column if not exists fecha_inicio  date;
alter table periodos_evaluativos add column if not exists fecha_fin     date;

-- ── 3. RLS PARA TABLAS DE PARÁMETROS ─────────────────

alter table config_asistencia   enable row level security;
alter table tipos_evaluacion    enable row level security;
alter table tipos_justificacion enable row level security;
alter table tipos_evento        enable row level security;
alter table periodos_evaluativos enable row level security;

-- config_asistencia
drop policy if exists "cfg_asist_inst" on config_asistencia;
create policy "cfg_asist_inst" on config_asistencia
  for all using (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  ) with check (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  );

-- tipos_evaluacion
drop policy if exists "tipos_eval_inst" on tipos_evaluacion;
create policy "tipos_eval_inst" on tipos_evaluacion
  for all using (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  ) with check (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  );

-- tipos_justificacion
drop policy if exists "tipos_just_inst" on tipos_justificacion;
create policy "tipos_just_inst" on tipos_justificacion
  for all using (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  ) with check (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  );

-- tipos_evento
drop policy if exists "tipos_evento_inst" on tipos_evento;
create policy "tipos_evento_inst" on tipos_evento
  for all using (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  ) with check (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  );

-- periodos_evaluativos
drop policy if exists "periodos_inst" on periodos_evaluativos;
create policy "periodos_inst" on periodos_evaluativos
  for all using (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  ) with check (
    institucion_id in (select institucion_id from usuarios where id = auth.uid())
  );

-- ── 4. RLS PARA orientaciones (catálogo global) ──────
-- Todos los usuarios autenticados pueden leer
-- Solo pueden insertar/modificar si están autenticados

alter table orientaciones enable row level security;

drop policy if exists "orientaciones_read" on orientaciones;
create policy "orientaciones_read" on orientaciones
  for select using (auth.uid() is not null);

drop policy if exists "orientaciones_write" on orientaciones;
create policy "orientaciones_write" on orientaciones
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ── 5. RECARGAR SCHEMA CACHE DE SUPABASE ─────────────
-- Necesario después de agregar columnas para que PostgREST
-- las reconozca sin reiniciar el proyecto
notify pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN ──────────────────────────────────
