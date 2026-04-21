-- =====================================================
-- EduGestión · Migración v2
-- Ejecutar en Supabase → SQL Editor → New Query
-- Seguro de re-ejecutar (usa IF NOT EXISTS / IF EXISTS)
-- =====================================================

-- ── 1. TABLA objetivo_incidentes ─────────────────────
-- Crear si no existe (caso base: tabla nueva)
create table if not exists objetivo_incidentes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

-- Agregar TODAS las columnas posibles (seguro si ya existen)
alter table objetivo_incidentes add column if not exists objetivo_id        uuid references objetivos(id) on delete cascade;
alter table objetivo_incidentes add column if not exists registrado_por     uuid references usuarios(id);
alter table objetivo_incidentes add column if not exists alumno_id          uuid references alumnos(id);
alter table objetivo_incidentes add column if not exists descripcion_alumno text;
alter table objetivo_incidentes add column if not exists curso_texto        text;
alter table objetivo_incidentes add column if not exists accion_tomada      text;
alter table objetivo_incidentes add column if not exists medida             text;
alter table objetivo_incidentes add column if not exists descripcion        text;

-- Si la tabla vieja incidentes_objetivo existe, copiar datos y eliminarla
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'incidentes_objetivo') then
    -- Copiar solo columnas base que siempre existen en la tabla vieja
    insert into objetivo_incidentes
      (id, objetivo_id, registrado_por, alumno_id, accion_tomada, medida, created_at)
    select id, objetivo_id, registrado_por, alumno_id, accion_tomada, medida, created_at
    from incidentes_objetivo
    on conflict (id) do nothing;
    drop table incidentes_objetivo cascade;
  end if;
end $$;

alter table objetivo_incidentes enable row level security;

drop policy if exists "incidentes_via_objetivo" on objetivo_incidentes;
create policy "incidentes_via_objetivo" on objetivo_incidentes
  for all using (
    objetivo_id in (
      select o.id from objetivos o
      join usuarios u on u.institucion_id = o.institucion_id
      where u.id = auth.uid()
    )
  );

-- ── 2. TABLA objetivo_hitos ───────────────────────────
create table if not exists objetivo_hitos (
  id              uuid primary key default gen_random_uuid(),
  objetivo_id     uuid references objetivos(id) on delete cascade,
  registrado_por  uuid references usuarios(id),
  titulo          text not null,
  descripcion     text,
  logrado         boolean default false,
  created_at      timestamptz default now()
);

alter table objetivo_hitos enable row level security;

drop policy if exists "hitos_via_objetivo" on objetivo_hitos;
create policy "hitos_via_objetivo" on objetivo_hitos
  for all using (
    objetivo_id in (
      select o.id from objetivos o
      join usuarios u on u.institucion_id = o.institucion_id
      where u.id = auth.uid()
    )
  );

-- ── 3. COLUMNAS NUEVAS EN objetivos ──────────────────
alter table objetivos add column if not exists categoria text;
alter table objetivos add column if not exists nivel     text;
alter table objetivos add column if not exists progreso  int default 0 check (progreso between 0 and 100);
alter table objetivos add column if not exists meta_descripcion   text;
alter table objetivos add column if not exists responsable_ids    jsonb;
alter table objetivos add column if not exists conclusion         text;
alter table objetivos add column if not exists cerrado_por        uuid references usuarios(id);
alter table objetivos add column if not exists cerrado_at         timestamptz;
alter table objetivos add column if not exists fecha_revision     date;
alter table objetivos add column if not exists updated_at         timestamptz default now();

-- ── 4. CORREGIR CHECK CONSTRAINTS DE objetivos ───────
-- estado: ('ok','warn','risk','cerrado') → ('activo','en_riesgo','logrado','archivado')
alter table objetivos drop constraint if exists objetivos_estado_check;
-- Migrar valores viejos antes de agregar nuevo constraint
update objetivos set estado = 'activo'    where estado = 'ok';
update objetivos set estado = 'en_riesgo' where estado in ('warn','risk');
update objetivos set estado = 'archivado' where estado = 'cerrado';
alter table objetivos add constraint objetivos_estado_check
  check (estado in ('activo','en_riesgo','logrado','archivado'));

-- tendencia: ('bajando','estable','subiendo') → ('mejorando','estable','empeorando')
alter table objetivos drop constraint if exists objetivos_tendencia_check;
update objetivos set tendencia = 'mejorando'  where tendencia = 'subiendo';
update objetivos set tendencia = 'empeorando' where tendencia = 'bajando';
alter table objetivos add constraint objetivos_tendencia_check
  check (tendencia in ('mejorando','estable','empeorando'));

-- cumplimiento → progreso: si cumplimiento tiene datos, copiar a progreso
update objetivos set progreso = cumplimiento where progreso = 0 and cumplimiento > 0;

-- ── 5. COLUMNAS NUEVAS EN alumnos ────────────────────
alter table alumnos add column if not exists observaciones_familiares text;

-- ── 6. TABLA contactos_alumno ─────────────────────────
create table if not exists contactos_alumno (
  id           uuid primary key default gen_random_uuid(),
  alumno_id    uuid references alumnos(id) on delete cascade,
  nombre       text not null,
  tipo         text,
  telefono     text,
  email        text,
  es_principal boolean default false,
  created_at   timestamptz default now()
);

alter table contactos_alumno enable row level security;
drop policy if exists "contactos_alumno_inst" on contactos_alumno;
create policy "contactos_alumno_inst" on contactos_alumno
  for all using (
    alumno_id in (
      select a.id from alumnos a
      join usuarios u on u.institucion_id = a.institucion_id
      where u.id = auth.uid()
    )
  );

-- ── 7. TABLA observaciones_legajo ────────────────────
create table if not exists observaciones_legajo (
  id              uuid primary key default gen_random_uuid(),
  alumno_id       uuid references alumnos(id) on delete cascade,
  registrado_por  uuid references usuarios(id),
  texto           text not null,
  privada         boolean default false,
  created_at      timestamptz default now()
);

alter table observaciones_legajo enable row level security;
drop policy if exists "obs_legajo_inst" on observaciones_legajo;
create policy "obs_legajo_inst" on observaciones_legajo
  for all using (
    alumno_id in (
      select a.id from alumnos a
      join usuarios u on u.institucion_id = a.institucion_id
      where u.id = auth.uid()
    )
  );

-- ── 8. TABLA intervenciones_eoe ──────────────────────
create table if not exists intervenciones_eoe (
  id              uuid primary key default gen_random_uuid(),
  alumno_id       uuid references alumnos(id) on delete cascade,
  registrado_por  uuid references usuarios(id),
  tipo            text,
  descripcion     text not null,
  derivacion      text,
  fecha           date not null,
  created_at      timestamptz default now()
);

alter table intervenciones_eoe enable row level security;
drop policy if exists "eoe_inst" on intervenciones_eoe;
create policy "eoe_inst" on intervenciones_eoe
  for all using (
    alumno_id in (
      select a.id from alumnos a
      join usuarios u on u.institucion_id = a.institucion_id
      where u.id = auth.uid()
    )
  );

-- ── 9. TABLA documentacion_alumno ────────────────────
create table if not exists documentacion_alumno (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid references alumnos(id) on delete cascade,
  subido_por  uuid references usuarios(id),
  nombre      text not null,
  tipo        text,
  url         text,
  created_at  timestamptz default now()
);

alter table documentacion_alumno enable row level security;
drop policy if exists "docs_alumno_inst" on documentacion_alumno;
create policy "docs_alumno_inst" on documentacion_alumno
  for all using (
    alumno_id in (
      select a.id from alumnos a
      join usuarios u on u.institucion_id = a.institucion_id
      where u.id = auth.uid()
    )
  );

-- ── 10. ROLES: expandir valores permitidos ───────────
alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check
  check (rol in (
    'director_general','directivo_nivel','directivo',
    'docente','preceptor','eoe','admin'
  ));

-- ── 11. CURSOS: agregar ciclo_lectivo ─────────────────
alter table cursos add column if not exists ciclo_lectivo int;
update cursos set ciclo_lectivo = extract(year from created_at)::int
  where ciclo_lectivo is null;

-- ── FIN DE MIGRACIÓN ──────────────────────────────────
