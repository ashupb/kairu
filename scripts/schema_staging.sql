-- ═══════════════════════════════════════════════════════════════
-- KAIRU — Schema completo para proyecto staging
-- Generado automáticamente el 2026-06-25
--
-- INSTRUCCIONES:
-- 1. Crear nuevo proyecto en supabase.com
-- 2. Ir a SQL Editor → New Query
-- 3. Pegar TODO este archivo y ejecutar
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: ../schema.sql
-- ─────────────────────────────────────────────────────────────
-- =====================================================
-- EduGestión · Kairos
-- Schema completo para Supabase
-- Ejecutar en: Supabase → SQL Editor → New Query
-- =====================================================

-- 1. INSTITUCIONES (multi-escuela desde el inicio)
create table instituciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  localidad text,
  logo_url text,
  created_at timestamptz default now()
);

-- 2. USUARIOS (extiende auth.users de Supabase)
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  institucion_id uuid references instituciones(id),
  nombre_completo text not null,
  rol text not null check (rol in ('directivo','docente','preceptor','eoe','admin')),
  activo boolean default true,
  avatar_iniciales text,
  created_at timestamptz default now()
);

-- 3. CURSOS
create table cursos (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid references instituciones(id),
  nombre text not null,
  anio int not null,
  division text not null,
  turno text check (turno in ('mañana','tarde','noche')),
  created_at timestamptz default now()
);

-- 4. ALUMNOS
create table alumnos (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid references instituciones(id),
  curso_id uuid references cursos(id),
  nombre text not null,
  apellido text not null,
  dni text,
  fecha_nacimiento date,
  activo boolean default true,
  created_at timestamptz default now()
);

-- 5. PROBLEMÁTICAS
create table problematicas (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid references instituciones(id),
  alumno_id uuid references alumnos(id),
  registrado_por uuid references usuarios(id),
  tipo text,
  urgencia text check (urgencia in ('alta','media','baja')) default 'media',
  descripcion text not null,
  estado text check (estado in ('abierta','en_seguimiento','resuelta','derivada')) default 'abierta',
  confidencial boolean default true,
  notificar_eoe boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. INTERVENCIONES (historial de cada problemática)
create table intervenciones (
  id uuid primary key default gen_random_uuid(),
  problematica_id uuid references problematicas(id) on delete cascade,
  registrado_por uuid references usuarios(id),
  titulo text not null,
  descripcion text not null,
  tipo text,
  proximo_paso text,
  created_at timestamptz default now()
);

-- 7. OBJETIVOS INSTITUCIONALES
create table objetivos (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid references instituciones(id),
  creado_por uuid references usuarios(id),
  nombre text not null,
  descripcion text,
  icono text default '🎯',
  responsable_texto text,
  meta text,
  criterio_medicion text,
  fecha_inicio date,
  fecha_cierre date,
  estado text check (estado in ('ok','warn','risk','cerrado')) default 'ok',
  cumplimiento int default 0 check (cumplimiento between 0 and 100),
  tendencia text check (tendencia in ('bajando','estable','subiendo')) default 'estable',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. INCIDENTES de objetivo
create table incidentes_objetivo (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid references objetivos(id) on delete cascade,
  registrado_por uuid references usuarios(id),
  alumno_id uuid references alumnos(id),
  descripcion_alumno text,
  curso_texto text,
  accion_tomada text not null,
  medida text,
  created_at timestamptz default now()
);

-- 9. REUNIONES
create table reuniones (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid references instituciones(id),
  creado_por uuid references usuarios(id),
  titulo text not null,
  descripcion text,
  fecha date not null,
  hora time,
  lugar text,
  created_at timestamptz default now()
);

-- 10. INVITACIONES A REUNIONES
create table reunion_invitados (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid references reuniones(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  estado text check (estado in ('pendiente','aceptada','rechazada')) default 'pendiente',
  created_at timestamptz default now(),
  unique(reunion_id, usuario_id)
);

-- 11. NOTIFICACIONES
create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  tipo text not null,
  titulo text not null,
  descripcion text,
  referencia_id uuid,
  referencia_tabla text,
  leida boolean default false,
  created_at timestamptz default now()
);

-- 12. ASISTENCIA
create table asistencias (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid references alumnos(id),
  registrado_por uuid references usuarios(id),
  fecha date not null,
  estado text check (estado in ('presente','ausente','tardanza','retiro')) not null,
  tipo_registro text check (tipo_registro in ('preceptor','docente')) default 'preceptor',
  materia_texto text,
  justificacion text,
  created_at timestamptz default now(),
  unique(alumno_id, fecha, tipo_registro, materia_texto)
);

-- =====================================================
-- SEGURIDAD: Row Level Security (RLS)
-- Cada usuario solo ve datos de su institución
-- =====================================================

alter table instituciones enable row level security;
alter table usuarios enable row level security;
alter table cursos enable row level security;
alter table alumnos enable row level security;
alter table problematicas enable row level security;
alter table intervenciones enable row level security;
alter table objetivos enable row level security;
alter table incidentes_objetivo enable row level security;
alter table reuniones enable row level security;
alter table reunion_invitados enable row level security;
alter table notificaciones enable row level security;
alter table asistencias enable row level security;

-- Política base: cada usuario ve su institución
create policy "usuarios_propia_institucion" on usuarios
  for all using (auth.uid() = id);

create policy "cursos_institucion" on cursos
  for all using (
    institucion_id in (
      select institucion_id from usuarios where id = auth.uid()
    )
  );

create policy "alumnos_institucion" on alumnos
  for all using (
    institucion_id in (
      select institucion_id from usuarios where id = auth.uid()
    )
  );

create policy "problematicas_institucion" on problematicas
  for all using (
    institucion_id in (
      select institucion_id from usuarios where id = auth.uid()
    )
  );

create policy "intervenciones_via_problematica" on intervenciones
  for all using (
    problematica_id in (
      select p.id from problematicas p
      join usuarios u on u.institucion_id = p.institucion_id
      where u.id = auth.uid()
    )
  );

create policy "objetivos_institucion" on objetivos
  for all using (
    institucion_id in (
      select institucion_id from usuarios where id = auth.uid()
    )
  );

create policy "incidentes_via_objetivo" on incidentes_objetivo
  for all using (
    objetivo_id in (
      select o.id from objetivos o
      join usuarios u on u.institucion_id = o.institucion_id
      where u.id = auth.uid()
    )
  );

create policy "reuniones_institucion" on reuniones
  for all using (
    institucion_id in (
      select institucion_id from usuarios where id = auth.uid()
    )
  );

create policy "invitados_propios" on reunion_invitados
  for all using (
    usuario_id = auth.uid() or
    reunion_id in (
      select r.id from reuniones r
      join usuarios u on u.institucion_id = r.institucion_id
      where u.id = auth.uid()
    )
  );

create policy "notificaciones_propias" on notificaciones
  for all using (usuario_id = auth.uid());

create policy "asistencias_institucion" on asistencias
  for all using (
    alumno_id in (
      select a.id from alumnos a
      join usuarios u on u.institucion_id = a.institucion_id
      where u.id = auth.uid()
    )
  );

-- =====================================================
-- MIGRACIÓN: descripcion en objetivo_incidentes
-- Ejecutar si la tabla ya existe sin esta columna
-- =====================================================
alter table objetivo_incidentes
  add column if not exists descripcion text;





-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v2.sql
-- ─────────────────────────────────────────────────────────────
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

-- ── 12. RLS PARA instituciones ───────────────────────
-- Sin estas políticas, el setup inicial falla al crear la institución

-- Cualquier usuario autenticado puede crear una institución nueva
drop policy if exists "instituciones_insert_auth" on instituciones;
create policy "instituciones_insert_auth" on instituciones
  for insert with check (auth.uid() is not null);

-- Cada usuario puede ver solo su propia institución
drop policy if exists "instituciones_select_propia" on instituciones;
create policy "instituciones_select_propia" on instituciones
  for select using (
    id in (select institucion_id from usuarios where id = auth.uid())
  );

-- El usuario puede actualizar los datos de su propia institución
drop policy if exists "instituciones_update_propia" on instituciones;
create policy "instituciones_update_propia" on instituciones
  for update using (
    id in (select institucion_id from usuarios where id = auth.uid())
  );

-- ── 13. COLUMNA username EN usuarios ─────────────────
-- Usada para login con nombre de usuario en lugar de email
alter table usuarios add column if not exists username  text unique;
alter table usuarios add column if not exists email     text;

-- ── FIN DE MIGRACIÓN ──────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v3.sql
-- ─────────────────────────────────────────────────────────────
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

-- Agregar columnas faltantes a tablas ya existentes (seguro si ya existen)
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

-- config_asistencia: agregar columnas que puede que no existan
alter table config_asistencia add column if not exists nivel                text;
alter table config_asistencia add column if not exists institucion_id       uuid references instituciones(id) on delete cascade;
alter table config_asistencia add column if not exists umbral_alerta_1      int default 10;
alter table config_asistencia add column if not exists umbral_alerta_2      int default 20;
alter table config_asistencia add column if not exists umbral_alerta_3      int default 30;
alter table config_asistencia add column if not exists justificadas_cuentan boolean default false;
alter table config_asistencia add column if not exists nota_minima          int default 7;
alter table config_asistencia add column if not exists escala               text default 'numerica';

-- periodos_evaluativos: quitar NOT NULL de columna numero si existe con esa restricción
alter table periodos_evaluativos alter column numero drop not null;

-- ── CORRECCIÓN FK asignaciones ────────────────────────
-- La FK docente_id apunta a la tabla docentes (nueva),
-- pero el sistema usa usuarios con rol='docente'.
-- Se cambia la referencia a usuarios(id).
alter table asignaciones drop constraint if exists asignaciones_docente_id_fkey;
alter table asignaciones add constraint asignaciones_docente_id_fkey
  foreign key (docente_id) references usuarios(id);

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

-- ── 5. NUEVAS COLUMNAS EN TABLAS EXISTENTES ──────────

-- DNI en usuarios (contraseña inicial y campo de referencia)
alter table usuarios add column if not exists dni text;

-- Logo en instituciones
alter table instituciones add column if not exists logo_url text;

-- ── 6. STORAGE BUCKET PARA LOGOS ─────────────────────
-- IMPORTANTE: crear manualmente desde Supabase Dashboard:
--   Storage → New bucket → nombre: "logos" → Public: ON
-- (No se puede crear desde SQL Editor)

-- ── 7. RLS PARA USUARIOS — permitir update propio DNI ─
-- La política existente de usuarios ya debería cubrir esto,
-- pero si hay error de RLS al guardar dni, agregar:
-- drop policy if exists "usuarios_update_own" on usuarios;
-- create policy "usuarios_update_own" on usuarios
--   for update using (auth.uid() = id or
--     institucion_id in (select institucion_id from usuarios where id = auth.uid()));

-- ── 8. TRIGGER: auto-insert en public.usuarios ───────
-- Cuando Supabase crea un auth user, este trigger inserta
-- automáticamente en public.usuarios leyendo user_metadata.
-- SECURITY DEFINER = corre como superuser, evita RLS.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.usuarios (
    id,
    email,
    nombre_completo,
    username,
    rol,
    nivel,
    activo,
    dni,
    institucion_id,
    cursos_ids
  ) values (
    new.id,
    new.email,
    coalesce(meta->>'nombre_completo', ''),
    coalesce(meta->>'username', split_part(new.email, '@', 1)),
    coalesce(meta->>'rol', 'docente'),
    nullif(meta->>'nivel', ''),
    coalesce((meta->>'activo')::boolean, true),
    nullif(meta->>'dni', ''),
    nullif(meta->>'institucion_id', '')::uuid,
    case
      when jsonb_array_length(meta->'cursos_ids') > 0
      then array(select jsonb_array_elements_text(meta->'cursos_ids'))::uuid[]
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Nunca interrumpir el flujo de auth por errores aquí
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 9. RLS COMPLETO PARA TABLA usuarios ──────────────
-- SELECT: ver la propia fila siempre + todos de la misma institución
-- El "auth.uid() = id" evita el problema de bootstrap circular.

drop policy if exists "usuarios_select_inst"  on usuarios;
drop policy if exists "usuarios_insert_admin" on usuarios;
drop policy if exists "usuarios_update_inst"  on usuarios;
drop policy if exists "usuarios_update_own"   on usuarios;

create policy "usuarios_select_inst" on usuarios
  for select using (
    auth.uid() = id
    or institucion_id = (
      select u2.institucion_id from usuarios u2 where u2.id = auth.uid()
    )
  );

create policy "usuarios_insert_admin" on usuarios
  for insert with check (
    institucion_id = (
      select u2.institucion_id from usuarios u2 where u2.id = auth.uid()
    )
  );

create policy "usuarios_update_inst" on usuarios
  for update using (
    auth.uid() = id
    or institucion_id = (
      select u2.institucion_id from usuarios u2 where u2.id = auth.uid()
    )
  );

-- ── 10. FK asignaciones con CASCADE ──────────────────
alter table asignaciones drop constraint if exists asignaciones_docente_id_fkey;
alter table asignaciones add constraint asignaciones_docente_id_fkey
  foreign key (docente_id) references usuarios(id) on delete cascade;

alter table cursos drop constraint if exists cursos_preceptor_id_fkey;
alter table cursos add constraint cursos_preceptor_id_fkey
  foreign key (preceptor_id) references usuarios(id) on delete set null;

alter table public.usuarios drop constraint if exists usuarios_id_fkey;
alter table public.usuarios add constraint usuarios_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- ── 11. FUNCIÓN: username → email (para login sin sesión) ─
-- La query de login corre antes de autenticarse (auth.uid = null),
-- por eso RLS bloquea el SELECT en usuarios.
-- Esta función corre con SECURITY DEFINER y bypassea RLS.

create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email
  from public.usuarios
  where username = p_username
    and activo = true
  limit 1;
$$;

-- Permitir que anon y authenticated llamen a la función
grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- ── 12. RECARGAR SCHEMA CACHE DE SUPABASE ────────────
notify pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN ──────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v5.sql
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v6.sql
-- ─────────────────────────────────────────────────────────────
-- =====================================================
-- Kairu · Migración v6
-- Soporte primaria e inicial:
--   · tipo en materias (comun/especial)
--   · tipo_docente en asignaciones (grado/especial)
--   · promedio editable en calificaciones
--   · escala_conceptual_valores en config_asistencia
--   · RLS asistencia para docente de grado
-- Ejecutar en Supabase → SQL Editor → New Query
-- Seguro de re-ejecutar (usa IF NOT EXISTS y DO $$)
-- =====================================================


-- ═══════════════════════════════════════════════════
-- 1. TABLA materias — columna tipo
-- ═══════════════════════════════════════════════════
-- 'comun':    materia a cargo del docente de grado
--             (Matemática, Lengua, Cs. Naturales, etc.)
-- 'especial': materia con docente propio
--             (Inglés, Ed. Física, Música, Plástica, etc.)

alter table materias add column if not exists tipo text default 'comun';

-- Rellenar filas existentes sin valor
update materias set tipo = 'comun' where tipo is null;

-- Marcar como NOT NULL
alter table materias alter column tipo set not null;

-- Agregar constraint si no existe
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name   = 'materias'
      and constraint_name = 'materias_tipo_check'
  ) then
    alter table materias
      add constraint materias_tipo_check
      check (tipo in ('comun', 'especial'));
  end if;
end $$;


-- ═══════════════════════════════════════════════════
-- 2. TABLA asignaciones — columna tipo_docente
-- ═══════════════════════════════════════════════════
-- NOTA: la spec de migración refería a esta columna como
-- 'tipo_asignacion' con valores ('grado','materia'), pero el
-- código JS ya usa 'tipo_docente' con valores ('grado','especial').
-- Esta migración sigue el código JS para no requerir cambios en JS.
--
-- 'grado':    docente responsable de TODAS las materias tipo='comun'
--             del curso. También toma la asistencia diaria.
--             Solo puede haber uno por curso × año lectivo.
-- 'especial': docente asignado a una materia específica.
--             Todos los docentes de secundario usan este tipo.

alter table asignaciones add column if not exists tipo_docente text default 'especial';

-- Rellenar filas existentes
update asignaciones set tipo_docente = 'especial' where tipo_docente is null;

-- Marcar como NOT NULL
alter table asignaciones alter column tipo_docente set not null;

-- Agregar constraint si no existe
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name   = 'asignaciones'
      and constraint_name = 'chk_asig_tipo_docente'
  ) then
    alter table asignaciones
      add constraint chk_asig_tipo_docente
      check (tipo_docente in ('grado', 'especial'));
  end if;
end $$;

-- materia_id debe ser nullable: en asignaciones de grado el docente
-- no tiene una materia específica (cubre todas las materias comunes)
alter table asignaciones alter column materia_id drop not null;

-- Unicidad: un solo docente de grado por curso × año lectivo
create unique index if not exists idx_asig_grado_unico
  on asignaciones (curso_id, anio_lectivo)
  where tipo_docente = 'grado';


-- ═══════════════════════════════════════════════════
-- 3. TABLA calificaciones — columnas de promedio editable
-- ═══════════════════════════════════════════════════
-- En primaria el promedio trimestral no es una media aritmética:
-- el docente realiza una valoración holística y puede ajustar
-- el valor calculado por el sistema.
-- Para ciclo 1 (1°-3°) el ajuste es sobre la escala conceptual.

alter table calificaciones add column if not exists promedio_calculado       numeric(4,2);
alter table calificaciones add column if not exists promedio_manual          numeric(4,2);
alter table calificaciones add column if not exists promedio_editado         boolean default false;
alter table calificaciones add column if not exists promedio_concepto_manual text;


-- ═══════════════════════════════════════════════════
-- 4. TABLA config_asistencia — escala_conceptual_valores
-- ═══════════════════════════════════════════════════
-- Array con los valores posibles de la escala conceptual.
-- Valor por defecto: ['MB','B','R','I']
-- Las escuelas pueden extenderla, ej:
-- ['Excelente','Muy Bueno','Bueno','Regular','Insuficiente']

alter table config_asistencia
  add column if not exists escala_conceptual_valores
  text[] default array['MB','B','R','I'];

-- Asignar valor por defecto en filas de primario ya existentes
update config_asistencia
   set escala_conceptual_valores = array['MB','B','R','I']
 where nivel = 'primario'
   and escala_conceptual_valores is null;


-- ═══════════════════════════════════════════════════
-- 5. RLS — asistencia para docente de grado
-- ═══════════════════════════════════════════════════
-- Un docente con tipo_docente='grado' necesita poder registrar
-- asistencia de los alumnos del curso que tiene asignado.
-- La policy unifica: acceso via institución (directivos/preceptores)
-- O via asignación de grado (docente del curso específico).

alter table asistencia enable row level security;

drop policy if exists "asist_docente_grado" on asistencia;
create policy "asist_docente_grado" on asistencia
  for all
  using (
    -- Acceso general: cualquier usuario de la institución
    institucion_id in (
      select institucion_id from usuarios where id = auth.uid()
    )
    or
    -- Acceso específico: docente de grado de ese curso
    curso_id in (
      select a.curso_id
      from   asignaciones a
      where  a.docente_id   = auth.uid()
        and  a.tipo_docente  = 'grado'
        and  a.anio_lectivo  = extract(year from now())::int
    )
  )
  with check (
    institucion_id in (
      select institucion_id from usuarios where id = auth.uid()
    )
    or
    curso_id in (
      select a.curso_id
      from   asignaciones a
      where  a.docente_id   = auth.uid()
        and  a.tipo_docente  = 'grado'
        and  a.anio_lectivo  = extract(year from now())::int
    )
  );


-- ═══════════════════════════════════════════════════
-- 6. RECARGAR SCHEMA CACHE
-- ═══════════════════════════════════════════════════
notify pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v6 ───────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v7.sql
-- ─────────────────────────────────────────────────────────────
-- =====================================================
-- MIGRATION V7 — Instancias calificación primaria
-- =====================================================

-- 1. Tabla instancias_calificacion
--    Una fila por alumno × materia × periodo × instancia evaluativa
--    (distinta de instancias_evaluativas que es por evento de curso para secundaria)
CREATE TABLE IF NOT EXISTS instancias_calificacion (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id      uuid REFERENCES alumnos(id)             ON DELETE CASCADE NOT NULL,
  materia_id     uuid REFERENCES materias(id)            ON DELETE CASCADE NOT NULL,
  curso_id       uuid REFERENCES cursos(id)              ON DELETE CASCADE NOT NULL,
  periodo_id     uuid REFERENCES periodos_evaluativos(id) ON DELETE CASCADE NOT NULL,
  institucion_id uuid REFERENCES instituciones(id)       ON DELETE CASCADE NOT NULL,
  nombre         text NOT NULL,
  valor_numerico numeric(4,2),
  valor_conceptual text,
  fecha          date,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE instancias_calificacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ic_select" ON instancias_calificacion FOR SELECT
  USING (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "ic_insert" ON instancias_calificacion FOR INSERT
  WITH CHECK (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "ic_update" ON instancias_calificacion FOR UPDATE
  USING (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "ic_delete" ON instancias_calificacion FOR DELETE
  USING (institucion_id IN (SELECT institucion_id FROM usuarios WHERE id = auth.uid()));

-- 2. Índice parcial en calificaciones para nota final de boletín (primaria)
--    Permite upsert by (alumno_id, materia_id, periodo_id) cuando instancia_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS calificaciones_nota_final_primaria_idx
  ON calificaciones (alumno_id, materia_id, periodo_id)
  WHERE instancia_id IS NULL AND materia_id IS NOT NULL;

-- =====================================================
-- EJECUTAR EN: Supabase → SQL Editor
-- =====================================================


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v8.sql
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v9.sql
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v10.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration v10: Drop intervenciones_tipo_check constraint
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- La constraint intervenciones_tipo_check limita el campo tipo
-- a un enum fijo del schema original. El sistema ahora usa nombres
-- libres desde la tabla tipos_intervencion, por lo que la constraint
-- bloquea todos los inserts de seguimiento.
ALTER TABLE intervenciones DROP CONSTRAINT IF EXISTS intervenciones_tipo_check;

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v11.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration v11: Tabla dias_no_lectivos
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dias_no_lectivos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id UUID REFERENCES instituciones(id) ON DELETE CASCADE NOT NULL,
  fecha          DATE NOT NULL,
  motivo         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institucion_id, fecha)
);

ALTER TABLE dias_no_lectivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY dnl_acceso ON dias_no_lectivos
FOR ALL TO authenticated
USING (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
)
WITH CHECK (
  institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
);

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v12.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration v12: Limpiar duplicados en tabla asistencia
--               y agregar constraint NULLS NOT DISTINCT
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── CONTEXTO ────────────────────────────────────────
-- El UNIQUE constraint estándar de PostgreSQL trata NULL != NULL,
-- por lo que filas con hora_clase=NULL y materia_id=NULL nunca
-- colisionan y upsert siempre inserta duplicados.
-- Esta migración:
--   1. Elimina los duplicados dejando el registro más reciente.
--   2. Crea un índice único con NULLS NOT DISTINCT para que
--      el constraint funcione correctamente con valores NULL.
-- ─────────────────────────────────────────────────────

-- ── 1. ELIMINAR DUPLICADOS ────────────────────────────
-- Para cada (alumno_id, fecha, hora_clase, materia_id)
-- conservar solo el registro con created_at más reciente.
DELETE FROM asistencia
WHERE id NOT IN (
  SELECT DISTINCT ON (
    alumno_id,
    fecha,
    COALESCE(hora_clase::text, ''),
    COALESCE(materia_id::text, '')
  )
    id
  FROM asistencia
  ORDER BY
    alumno_id,
    fecha,
    COALESCE(hora_clase::text, ''),
    COALESCE(materia_id::text, ''),
    created_at DESC NULLS LAST,
    id DESC
);

-- ── 2. DROP DEL ÍNDICE/CONSTRAINT ANTERIOR (si existe) ──
DROP INDEX IF EXISTS asistencia_alumno_fecha_hora_materia_idx;
DROP INDEX IF EXISTS asistencia_unico_idx;

-- Si hay un UNIQUE constraint de tabla, eliminarlo:
DO $$
DECLARE
  cname text;
BEGIN
  SELECT constraint_name INTO cname
  FROM information_schema.table_constraints
  WHERE table_schema   = 'public'
    AND table_name     = 'asistencia'
    AND constraint_type = 'UNIQUE'
    AND constraint_name NOT LIKE '%_pkey';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE asistencia DROP CONSTRAINT IF EXISTS %I', cname);
  END IF;
END $$;

-- ── 3. CREAR ÍNDICE ÚNICO CON NULLS NOT DISTINCT ────────
-- PostgreSQL 15+ (Supabase lo soporta).
-- NULLS NOT DISTINCT trata dos NULL como iguales en el constraint,
-- evitando que se inserten duplicados cuando hora_clase y materia_id son NULL.
CREATE UNIQUE INDEX IF NOT EXISTS asistencia_unico_idx
  ON asistencia (alumno_id, fecha, hora_clase, materia_id)
  NULLS NOT DISTINCT;

-- ── 4. RECARGAR SCHEMA CACHE ─────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v12 ──────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v13.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration v13: Recalcular total_faltas en alertas_asistencia
-- Corrige registros stale generados antes del fix de duplicados
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── CONTEXTO ────────────────────────────────────────
-- Antes del fix v12, la tabla asistencia tenía duplicados por el
-- comportamiento NULL != NULL del UNIQUE constraint. Esto generó
-- alertas con total_faltas inflado (ej: 10 en vez de 7.5).
-- Esta migración recalcula total_faltas para todos los alumnos
-- usando solo registros diarios (hora_clase IS NULL) deduplicados
-- por fecha (conservando el más reciente).
-- ─────────────────────────────────────────────────────

UPDATE alertas_asistencia aa
SET total_faltas = sub.total
FROM (
  SELECT
    alumno_id,
    SUM(
      CASE estado
        WHEN 'ausente'     THEN 1.0
        WHEN 'media_falta' THEN 0.5
        WHEN 'tardanza'    THEN 0.25
        ELSE 0
      END
    ) AS total
  FROM (
    SELECT DISTINCT ON (alumno_id, fecha)
      alumno_id, estado
    FROM asistencia
    WHERE hora_clase IS NULL
    ORDER BY alumno_id, fecha, created_at DESC NULLS LAST, id DESC
  ) deduped
  GROUP BY alumno_id
) sub
WHERE aa.alumno_id = sub.alumno_id
  AND aa.total_faltas IS DISTINCT FROM sub.total;

-- Recargar schema cache
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v13 ──────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v14.sql
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v15.sql
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v16.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration v16: Columnas faltantes en materias_estado_alumno
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Si materias_estado_alumno existía antes de v15 (sin curso_id),
-- el CREATE TABLE IF NOT EXISTS no agrega las columnas nuevas.
-- Esta migración las agrega de forma segura.

ALTER TABLE materias_estado_alumno
  ADD COLUMN IF NOT EXISTS curso_id              uuid REFERENCES cursos(id),
  ADD COLUMN IF NOT EXISTS institucion_id        uuid REFERENCES instituciones(id),
  ADD COLUMN IF NOT EXISTS ciclo_lectivo_origen  integer,
  ADD COLUMN IF NOT EXISTS ciclo_lectivo_cursado integer,
  ADD COLUMN IF NOT EXISTS nota_final            numeric(4,2),
  ADD COLUMN IF NOT EXISTS nota_intensif_1       numeric(4,2),
  ADD COLUMN IF NOT EXISTS nota_intensif_2       numeric(4,2),
  ADD COLUMN IF NOT EXISTS periodo_id            uuid REFERENCES periodos_intensificacion(id);

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v16 ──────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v17.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration v17: Fechas de ciclo lectivo y activación del sistema
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

ALTER TABLE instituciones
  ADD COLUMN IF NOT EXISTS fecha_inicio_ciclo date,
  ADD COLUMN IF NOT EXISTS fecha_fin_ciclo    date,
  ADD COLUMN IF NOT EXISTS fecha_activacion   timestamptz;

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v17 ──────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v18.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration v18: Drop problematicas_tipo_check constraint
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- La constraint problematicas_tipo_check limita el campo tipo
-- a un enum fijo del schema original. El sistema ahora usa nombres
-- libres desde la tabla tipos_problematicas, por lo que la constraint
-- bloquea todos los inserts con tipos personalizados.
ALTER TABLE problematicas DROP CONSTRAINT IF EXISTS problematicas_tipo_check;

-- Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v18 ──────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: derivaciones.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration: tabla derivaciones + RLS
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS derivaciones (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id      UUID        NOT NULL REFERENCES instituciones(id),
  alumno_id           UUID        NOT NULL REFERENCES alumnos(id),
  problematica_id     UUID        REFERENCES problematicas(id),
  tipo_servicio       TEXT        NOT NULL CHECK (tipo_servicio IN (
                        'salud_mental', 'hospital', 'trabajo_social',
                        'justicia', 'educacion_especial', 'otro'
                      )),
  institucion_destino TEXT        NOT NULL,
  profesional_destino TEXT,
  fecha_derivacion    DATE        NOT NULL,
  motivo              TEXT        NOT NULL,
  estado              TEXT        NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
                        'pendiente', 'en_seguimiento', 'con_respuesta', 'cerrada'
                      )),
  respuesta           TEXT,
  fecha_respuesta     DATE,
  creado_por          UUID        NOT NULL REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE derivaciones ENABLE ROW LEVEL SECURITY;

-- EOE, director_general y directivo_nivel pueden ver derivaciones de su institución
CREATE POLICY "derivaciones_select" ON derivaciones
  FOR SELECT USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid())
        IN ('eoe', 'director_general', 'directivo_nivel')
  );

-- Solo EOE puede insertar
CREATE POLICY "derivaciones_insert" ON derivaciones
  FOR INSERT WITH CHECK (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
    AND creado_por = auth.uid()
  );

-- Solo EOE puede actualizar (registrar respuesta/estado)
CREATE POLICY "derivaciones_update" ON derivaciones
  FOR UPDATE USING (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- ─── columna confidencial en observaciones_legajo ─────
ALTER TABLE observaciones_legajo
  ADD COLUMN IF NOT EXISTS confidencial BOOLEAN DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: actividades_eoe.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration: columnas actividades EOE en tabla reuniones
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

ALTER TABLE reuniones
  ADD COLUMN IF NOT EXISTS tipo_actividad      TEXT
    CHECK (tipo_actividad IN ('charla', 'taller', 'entrevista_grupal', 'otra')),
  ADD COLUMN IF NOT EXISTS problematica_id     UUID REFERENCES problematicas(id),
  ADD COLUMN IF NOT EXISTS destinatarios_tipo  TEXT
    CHECK (destinatarios_tipo IN ('curso', 'alumnos_individuales')),
  ADD COLUMN IF NOT EXISTS destinatarios_ids   UUID[],
  ADD COLUMN IF NOT EXISTS destinatarios_texto TEXT;

-- Las reuniones existentes sin tipo_actividad quedan con NULL y no aparecen
-- en el panel EOE (el filtro es: tipo_actividad IS NOT NULL).

-- RLS: verificar que EOE pueda hacer INSERT en reuniones.
-- Si la política actual no lo cubre, agregar:
--
-- CREATE POLICY "eoe_insert_actividades" ON reuniones
--   FOR INSERT WITH CHECK (
--     institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
--     AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
--   );
--
-- Verificar políticas existentes con:
--   SELECT * FROM pg_policies WHERE tablename = 'reuniones';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: actividades_eoe_v2.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration: actividades EOE v2 — múltiples encuentros,
--            multi-curso, vinculación a objetivo, agenda,
--            objetivo y resultado separados
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Ampliar CHECK de destinatarios_tipo
ALTER TABLE reuniones DROP CONSTRAINT IF EXISTS reuniones_destinatarios_tipo_check;
ALTER TABLE reuniones ADD CONSTRAINT reuniones_destinatarios_tipo_check
  CHECK (destinatarios_tipo IN (
    'curso',
    'alumnos_individuales',
    'nivel_completo',
    'cursos_multiples'
  ));

-- 2. Nuevas columnas en reuniones
ALTER TABLE reuniones
  ADD COLUMN IF NOT EXISTS objetivo_id        UUID REFERENCES objetivos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS en_agenda          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS objetivo_actividad TEXT,
  ADD COLUMN IF NOT EXISTS resultado          TEXT,
  ADD COLUMN IF NOT EXISTS nivel_destinatario TEXT;

-- 3. Tabla para encuentros adicionales
CREATE TABLE IF NOT EXISTS actividad_encuentros (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  reunion_id UUID        NOT NULL REFERENCES reuniones(id) ON DELETE CASCADE,
  fecha      DATE        NOT NULL,
  hora       TIME,
  tematica   TEXT,
  orden      INTEGER     DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS para actividad_encuentros
ALTER TABLE actividad_encuentros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inst_select_encuentros" ON actividad_encuentros
  FOR SELECT USING (
    reunion_id IN (
      SELECT id FROM reuniones
      WHERE institucion_id = (
        SELECT institucion_id FROM usuarios WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "eoe_insert_encuentros" ON actividad_encuentros
  FOR INSERT WITH CHECK (
    reunion_id IN (
      SELECT id FROM reuniones
      WHERE institucion_id = (
        SELECT institucion_id FROM usuarios WHERE id = auth.uid()
      )
    )
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

CREATE POLICY "eoe_delete_encuentros" ON actividad_encuentros
  FOR DELETE USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- 5. (Opcional) Si EOE no puede insertar en reuniones, ejecutar:
--
-- CREATE POLICY "eoe_insert_actividades" ON reuniones
--   FOR INSERT WITH CHECK (
--     institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
--     AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
--   );
--
-- Verificar con: SELECT * FROM pg_policies WHERE tablename = 'reuniones';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: actividades_eoe_v3.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════
-- Migration: actividades EOE v3 — RLS para tablas de soporte
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. EOE puede UPDATE sus propias actividades (reuniones con tipo_actividad)
CREATE POLICY "eoe_update_actividades" ON reuniones
  FOR UPDATE USING (
    tipo_actividad IS NOT NULL
    AND institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  )
  WITH CHECK (
    tipo_actividad IS NOT NULL
    AND institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- 2. EOE puede insertar invitados a sus actividades
CREATE POLICY "eoe_insert_reunion_invitados" ON reunion_invitados
  FOR INSERT WITH CHECK (
    reunion_id IN (
      SELECT id FROM reuniones
      WHERE institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    )
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- 3. Cualquier usuario autenticado puede insertar notificaciones para otros usuarios
--    (necesario para EOE, docentes y preceptores que generan notificaciones cruzadas)
CREATE POLICY "auth_insert_notificaciones" ON notificaciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. EOE puede insertar eventos en la agenda institucional
CREATE POLICY "eoe_insert_eventos_institucionales" ON eventos_institucionales
  FOR INSERT WITH CHECK (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- Verificar políticas resultantes con:
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename IN ('reuniones','reunion_invitados','notificaciones','eventos_institucionales')
--   ORDER BY tablename, policyname;


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v19_seguimiento_familias.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v19: RLS para módulo Seguimiento del portal de familias
-- Permite que el rol 'familia' lea trayectoria y calificaciones
-- de sus alumnos vinculados (tabla familia_alumno).
--
-- Ejecutar en Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ── 1. materias_estado_alumno ─────────────────────────────────────
ALTER TABLE materias_estado_alumno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materias_estado_acceso" ON materias_estado_alumno;
DROP POLICY IF EXISTS "materias_estado_write"  ON materias_estado_alumno;

-- Lectura: staff institucional O familia con alumno vinculado
CREATE POLICY "materias_estado_acceso" ON materias_estado_alumno
FOR SELECT TO authenticated
USING (
  alumno_id IN (
    SELECT a.id FROM alumnos a
    WHERE a.institucion_id = (
      SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
    )
  )
  OR
  alumno_id IN (
    SELECT fa.alumno_id FROM familia_alumno fa
    WHERE fa.usuario_id = auth.uid()
  )
);

-- Escritura: solo staff (acceso por institución)
CREATE POLICY "materias_estado_write" ON materias_estado_alumno
FOR ALL TO authenticated
USING (
  alumno_id IN (
    SELECT a.id FROM alumnos a
    WHERE a.institucion_id = (
      SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
    )
  )
)
WITH CHECK (
  alumno_id IN (
    SELECT a.id FROM alumnos a
    WHERE a.institucion_id = (
      SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
    )
  )
);


-- ── 2. calificaciones ────────────────────────────────────────────
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calificaciones_select" ON calificaciones;
DROP POLICY IF EXISTS "calificaciones_write"  ON calificaciones;

-- Lectura: staff por institución / familias por alumno vinculado
CREATE POLICY "calificaciones_select" ON calificaciones
FOR SELECT TO authenticated
USING (
  alumno_id IN (
    SELECT a.id FROM alumnos a
    WHERE a.institucion_id = (
      SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
    )
  )
  OR
  alumno_id IN (
    SELECT fa.alumno_id FROM familia_alumno fa
    WHERE fa.usuario_id = auth.uid()
  )
);

-- Escritura: solo staff (necesita curso_id en la misma institución)
CREATE POLICY "calificaciones_write" ON calificaciones
FOR ALL TO authenticated
USING (
  curso_id IN (
    SELECT c.id FROM cursos c
    WHERE c.institucion_id = (
      SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
    )
  )
)
WITH CHECK (
  curso_id IN (
    SELECT c.id FROM cursos c
    WHERE c.institucion_id = (
      SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
    )
  )
);


-- ── 3. periodos_intensificacion ───────────────────────────────────
ALTER TABLE periodos_intensificacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "periodos_intensif_select" ON periodos_intensificacion;
DROP POLICY IF EXISTS "periodos_intensif_write"  ON periodos_intensificacion;

CREATE POLICY "periodos_intensif_select" ON periodos_intensificacion
FOR SELECT TO authenticated
USING (
  institucion_id = (
    SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
  )
);

CREATE POLICY "periodos_intensif_write" ON periodos_intensificacion
FOR ALL TO authenticated
USING (
  institucion_id = (
    SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
  )
)
WITH CHECK (
  institucion_id = (
    SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
  )
);


-- ── 4. cierres_periodo ────────────────────────────────────────────
ALTER TABLE cierres_periodo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cierres_periodo_select" ON cierres_periodo;
DROP POLICY IF EXISTS "cierres_periodo_write"  ON cierres_periodo;

CREATE POLICY "cierres_periodo_select" ON cierres_periodo
FOR SELECT TO authenticated
USING (
  institucion_id = (
    SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
  )
);

CREATE POLICY "cierres_periodo_write" ON cierres_periodo
FOR ALL TO authenticated
USING (
  institucion_id = (
    SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
  )
)
WITH CHECK (
  institucion_id = (
    SELECT u.institucion_id FROM usuarios u WHERE u.id = auth.uid()
  )
);


-- ── 5. Recargar schema cache ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v19 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v20_fix_tipos_instancia.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v20: Unificar tipos de instancia evaluativa
--
-- El modal de "Nueva instancia" leía de tipos_evaluacion (tabla
-- legacy vacía). La configuración gestiona tipos_instancia_evaluativa.
-- Esta migración corrige el FK de instancias_evaluativas para apuntar
-- a la tabla correcta.
--
-- Ejecutar en Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar es_recuperatorio a tipos_instancia_evaluativa
ALTER TABLE tipos_instancia_evaluativa
  ADD COLUMN IF NOT EXISTS es_recuperatorio boolean DEFAULT false;

-- 2. Corregir el FK de instancias_evaluativas.tipo_id
--    Antes apuntaba a tipos_evaluacion, ahora apunta a tipos_instancia_evaluativa.
--    Se usa el nombre de constraint convencional de PostgreSQL.
ALTER TABLE instancias_evaluativas
  DROP CONSTRAINT IF EXISTS instancias_evaluativas_tipo_id_fkey;

ALTER TABLE instancias_evaluativas
  ADD CONSTRAINT instancias_evaluativas_tipo_id_fkey
  FOREIGN KEY (tipo_id) REFERENCES tipos_instancia_evaluativa(id) ON DELETE SET NULL;

-- 3. Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v20 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v21_comunicados_imagen_nivel.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v21: Agregar imagen_url y nivel a comunicados
--
-- imagen_url: URL de imagen opcional en Supabase Storage
-- nivel:      filtro de nivel educativo para comunicados
--             institucionales ('inicial', 'primario', 'secundario').
--             NULL = visible para todos los niveles de la institución.
--
-- Ejecutar en Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columnas
ALTER TABLE comunicados
  ADD COLUMN IF NOT EXISTS imagen_url text,
  ADD COLUMN IF NOT EXISTS nivel      text;

-- 2. Validar valores de nivel
ALTER TABLE comunicados
  ADD CONSTRAINT com_nivel_check
  CHECK (nivel IS NULL OR nivel IN ('inicial', 'primario', 'secundario'));

-- 3. Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v21 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v22_comunicado_lecturas.sql
-- ─────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════
-- v22 — Tabla comunicado_lecturas
-- Registra qué familiar leyó qué comunicado
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.comunicado_lecturas (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id uuid        NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  usuario_id    uuid        NOT NULL,
  leido_at      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT comunicado_lecturas_uq UNIQUE (comunicado_id, usuario_id)
);

-- RLS: cada usuario solo puede ver y crear sus propias lecturas
ALTER TABLE public.comunicado_lecturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecturas_propias_select" ON public.comunicado_lecturas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "lecturas_propias_insert" ON public.comunicado_lecturas
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v23_comunicado_imagenes.sql
-- ─────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════
-- v23 — Tabla comunicado_imagenes
-- Soporte para múltiples imágenes por comunicado
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.comunicado_imagenes (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id uuid        NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  imagen_url    text        NOT NULL,
  orden         integer     NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comunicado_imagenes_com_idx
  ON public.comunicado_imagenes(comunicado_id, orden);

ALTER TABLE public.comunicado_imagenes ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer imágenes
-- (el filtro de institución aplica en la query del comunicado padre)
CREATE POLICY "imagenes_select" ON public.comunicado_imagenes
  FOR SELECT TO authenticated USING (true);

-- Solo usuarios internos (directivos) insertan; la app lo controla
CREATE POLICY "imagenes_insert" ON public.comunicado_imagenes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Solo usuarios internos eliminan; la app lo controla
CREATE POLICY "imagenes_delete" ON public.comunicado_imagenes
  FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v24_comunicados_tipos.sql
-- ─────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════
-- v24 — Tipos de comunicados: novedad / comunicado + curso_id
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Agregar curso_id para comunicados dirigidos a un curso específico
ALTER TABLE public.comunicados
  ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES public.cursos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comunicados_curso_idx
  ON public.comunicados(curso_id);

-- 2. Eliminar constraints que bloquean el renombrado del tipo
ALTER TABLE public.comunicados DROP CONSTRAINT IF EXISTS com_aula_requiere_curso;
ALTER TABLE public.comunicados DROP CONSTRAINT IF EXISTS comunicados_tipo_check;

-- 3. Renombrar tipo existente: los comunicados actuales eran novedades institucionales
UPDATE public.comunicados SET tipo = 'novedad' WHERE tipo = 'institucional';

-- 4. Recrear constraint de tipo con los nuevos valores válidos
ALTER TABLE public.comunicados ADD CONSTRAINT comunicados_tipo_check
  CHECK (tipo IN ('novedad', 'comunicado'));

-- 5. Nueva constraint: solo los comunicados por curso requieren curso_id
ALTER TABLE public.comunicados ADD CONSTRAINT com_aula_requiere_curso
  CHECK (tipo != 'comunicado' OR curso_id IS NOT NULL);

-- Resultado de valores de tipo:
--   'novedad'     → Novedades institucionales (con imágenes, por nivel, sin campana)
--   'comunicado'  → Comunicados por curso (sin fotos, con campana para familias)

NOTIFY pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v25_comunicados_rls_familias.sql
-- ─────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════
-- v25 — RLS: permitir que usuarios familia lean comunicados
--
-- Los usuarios con rol='familia' están en la tabla usuarios con
-- institucion_id. Sin embargo, si la policy de comunicados excluye
-- implícitamente a ese rol, las novedades no aparecen en la app.
--
-- Esta migración agrega una política de lectura explícita que cubre
-- a TODOS los usuarios autenticados de la institución (staff + familia).
-- Las políticas de escritura siguen siendo solo para staff.
--
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas de lectura previas para evitar duplicados
DROP POLICY IF EXISTS "comunicados_select"        ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_read"          ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_familia_read"  ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_inst"          ON public.comunicados;

-- Lectura: cualquier usuario autenticado de la institución (incluye familia)
CREATE POLICY "comunicados_select" ON public.comunicados
FOR SELECT TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios WHERE id = auth.uid()
  )
);

-- Escritura: solo staff (roles que no son 'familia')
DROP POLICY IF EXISTS "comunicados_write"        ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_write"  ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_insert" ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_update" ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_delete" ON public.comunicados;

CREATE POLICY "comunicados_staff_insert" ON public.comunicados
FOR INSERT TO authenticated
WITH CHECK (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "comunicados_staff_update" ON public.comunicados
FOR UPDATE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "comunicados_staff_delete" ON public.comunicados
FOR DELETE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v25 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v26_eventos_rls_familias.sql
-- ─────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════
-- v26 — RLS: permitir que usuarios familia lean eventos_institucionales
--
-- Si la tabla tiene RLS activado sin política para el rol 'familia',
-- la query de la app de familias devuelve vacío silenciosamente.
-- Esta migración agrega una política de lectura que cubre a todos
-- los usuarios autenticados de la institución (staff + familia).
--
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.eventos_institucionales ENABLE ROW LEVEL SECURITY;

-- Eliminar política previa si existe
DROP POLICY IF EXISTS "eventos_select"         ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_read"           ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_familia_read"   ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_inst"           ON public.eventos_institucionales;

-- Lectura: cualquier usuario autenticado de la institución (incluye familia)
CREATE POLICY "eventos_select" ON public.eventos_institucionales
FOR SELECT TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios WHERE id = auth.uid()
  )
);

-- Escritura: solo staff (roles que no son 'familia')
DROP POLICY IF EXISTS "eventos_staff_insert" ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_staff_update" ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_staff_delete" ON public.eventos_institucionales;

CREATE POLICY "eventos_staff_insert" ON public.eventos_institucionales
FOR INSERT TO authenticated
WITH CHECK (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "eventos_staff_update" ON public.eventos_institucionales
FOR UPDATE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "eventos_staff_delete" ON public.eventos_institucionales
FOR DELETE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v26 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v27_agenda_familias.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v27: Agenda — citas individuales + RSVP familias
-- Aplicar manualmente en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Columnas nuevas en eventos_institucionales
ALTER TABLE eventos_institucionales
  ADD COLUMN IF NOT EXISTS cursos_familias_ids  UUID[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hora_fin             TIME     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS alumno_id            UUID     REFERENCES alumnos(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS problematica_id      UUID     REFERENCES problematicas(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS es_cita_individual   BOOLEAN  DEFAULT FALSE;

-- 2. Mensaje en evento_respuestas (propuesta de horario alternativo)
ALTER TABLE evento_respuestas
  ADD COLUMN IF NOT EXISTS mensaje TEXT DEFAULT NULL;

-- 3. Índice para búsqueda de citas por alumno
CREATE INDEX IF NOT EXISTS idx_eventos_alumno_id
  ON eventos_institucionales(alumno_id)
  WHERE alumno_id IS NOT NULL;

-- 4. RLS: familiares pueden insertar/actualizar su propia respuesta
--    (ejecutar solo si RLS está habilitado en evento_respuestas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'evento_respuestas' AND c.relrowsecurity = TRUE
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'evento_respuestas' AND policyname = 'familiar_rsvp_insert'
    ) THEN
      EXECUTE 'CREATE POLICY familiar_rsvp_insert ON evento_respuestas FOR INSERT WITH CHECK (auth.uid() = usuario_id)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'evento_respuestas' AND policyname = 'familiar_rsvp_update'
    ) THEN
      EXECUTE 'CREATE POLICY familiar_rsvp_update ON evento_respuestas FOR UPDATE USING (auth.uid() = usuario_id)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'evento_respuestas' AND policyname = 'familiar_rsvp_select'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY familiar_rsvp_select ON evento_respuestas FOR SELECT USING (
          auth.uid() = usuario_id
          OR EXISTS (
            SELECT 1 FROM eventos_institucionales e
            WHERE e.id = evento_id
              AND (
                e.creado_por = auth.uid()
                OR auth.uid() = ANY(COALESCE(e.convocados_ids, '{}'))
                OR auth.uid() = ANY(COALESCE(e.responsables_ids, '{}'))
              )
          )
        )
      $policy$;
    END IF;
  END IF;
END $$;

-- 5. Comentarios
COMMENT ON COLUMN eventos_institucionales.cursos_familias_ids IS 'NULL = todas las familias del nivel; con IDs = solo esas familias de esos cursos';
COMMENT ON COLUMN eventos_institucionales.hora_fin            IS 'Hora de fin para eventos con rango horario';
COMMENT ON COLUMN eventos_institucionales.alumno_id           IS 'Citas individuales: alumno convocado';
COMMENT ON COLUMN eventos_institucionales.problematica_id     IS 'Citas individuales: problemática asociada (opcional)';
COMMENT ON COLUMN eventos_institucionales.es_cita_individual  IS 'TRUE = cita individual para familia; FALSE = evento colectivo';
COMMENT ON COLUMN evento_respuestas.mensaje                   IS 'Mensaje adicional o propuesta de horario alternativo';


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v28_evento_respuestas_rls.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v28: RLS explícito para evento_respuestas
--
-- La tabla evento_respuestas puede tener RLS activado pero sin
-- políticas que permitan a familias insertar/actualizar sus RSVP.
-- Esta migración habilita RLS y crea las políticas explícitamente.
--
-- Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Habilitar RLS (idempotente)
ALTER TABLE public.evento_respuestas ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores que puedan existir
DROP POLICY IF EXISTS familiar_rsvp_select ON public.evento_respuestas;
DROP POLICY IF EXISTS familiar_rsvp_insert ON public.evento_respuestas;
DROP POLICY IF EXISTS familiar_rsvp_update ON public.evento_respuestas;
DROP POLICY IF EXISTS "familiar_rsvp_select" ON public.evento_respuestas;
DROP POLICY IF EXISTS "familiar_rsvp_insert" ON public.evento_respuestas;
DROP POLICY IF EXISTS "familiar_rsvp_update" ON public.evento_respuestas;

-- SELECT: propias filas O staff del evento (convocados + creador)
CREATE POLICY "familiar_rsvp_select" ON public.evento_respuestas
FOR SELECT TO authenticated
USING (
  auth.uid() = usuario_id
  OR EXISTS (
    SELECT 1 FROM public.eventos_institucionales e
    WHERE e.id = evento_id
      AND (
        e.creado_por = auth.uid()
        OR auth.uid() = ANY(COALESCE(e.convocados_ids, '{}'))
        OR auth.uid() = ANY(COALESCE(e.responsables_ids, '{}'))
      )
  )
);

-- INSERT: solo puede insertar su propia fila
CREATE POLICY "familiar_rsvp_insert" ON public.evento_respuestas
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = usuario_id);

-- UPDATE: solo puede actualizar su propia fila
CREATE POLICY "familiar_rsvp_update" ON public.evento_respuestas
FOR UPDATE TO authenticated
USING (auth.uid() = usuario_id);

-- Recargar schema de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v28 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v29_evento_respuestas_add_propone.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v29: Agregar 'propone' al CHECK constraint de evento_respuestas
--
-- La constraint evento_respuestas_respuesta_check solo permite
-- ('acepta','rechaza','cancela'). Hay que agregar 'propone' para
-- el flujo de propuesta de otro horario desde el portal de familias.
--
-- Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Los datos existentes usaban formato largo ('aceptada', 'pendiente').
-- El código actual usa formato corto ('acepta', 'rechaza', 'cancela', 'propone').
-- Esta migración normaliza los datos y actualiza la constraint.

-- Migrar 'aceptada' al formato nuevo
UPDATE public.evento_respuestas SET respuesta = 'acepta'   WHERE respuesta = 'aceptada';
UPDATE public.evento_respuestas SET respuesta = 'rechaza'  WHERE respuesta = 'rechazada';
UPDATE public.evento_respuestas SET respuesta = 'cancela'  WHERE respuesta = 'cancelada';

-- Borrar filas 'pendiente' (pendiente = sin fila en la tabla, no se almacena)
DELETE FROM public.evento_respuestas WHERE respuesta = 'pendiente';

-- Eliminar constraint vieja
ALTER TABLE public.evento_respuestas
  DROP CONSTRAINT IF EXISTS evento_respuestas_respuesta_check;

-- Recrear con todos los valores nuevos
ALTER TABLE public.evento_respuestas
  ADD CONSTRAINT evento_respuestas_respuesta_check
  CHECK (respuesta IN ('acepta', 'rechaza', 'cancela', 'propone'));

-- ── FIN DE MIGRACIÓN v29 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v30_notificaciones_rls.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v30: RLS para notificaciones + lectura de familia_alumno
--
-- 1. notificaciones: SELECT y UPDATE propios (para que familias puedan
--    leer sus notificaciones y marcarlas como leídas).
-- 2. familia_alumno: SELECT para staff autenticado (para que la app
--    interna pueda encontrar los usuarios-familia de un alumno y
--    enviarles notificaciones de cita).
--
-- Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── notificaciones ────────────────────────────────────────────────

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: cada usuario ve solo sus propias notificaciones
DROP POLICY IF EXISTS "notif_own_select" ON public.notificaciones;
CREATE POLICY "notif_own_select" ON public.notificaciones
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);

-- UPDATE: cada usuario puede actualizar solo sus propias notificaciones
--         (para marcar leida = true)
DROP POLICY IF EXISTS "notif_own_update" ON public.notificaciones;
CREATE POLICY "notif_own_update" ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id);

-- INSERT: cualquier usuario autenticado puede insertar (ya existía, idempotente)
DROP POLICY IF EXISTS "auth_insert_notificaciones" ON public.notificaciones;
CREATE POLICY "auth_insert_notificaciones" ON public.notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── familia_alumno ────────────────────────────────────────────────

ALTER TABLE public.familia_alumno ENABLE ROW LEVEL SECURITY;

-- SELECT: familias ven sus propios vínculos; staff ve los de su institución
DROP POLICY IF EXISTS "familia_alumno_select" ON public.familia_alumno;
CREATE POLICY "familia_alumno_select" ON public.familia_alumno
  FOR SELECT TO authenticated
  USING (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM public.alumnos a
      JOIN public.cursos c ON c.id = a.curso_id
      WHERE a.id = alumno_id
        AND c.institucion_id = (SELECT institucion_id FROM public.usuarios WHERE id = auth.uid())
    )
  );

-- Recargar schema de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v30 ──────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: fix_rls_alumnos.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- FIX: Recursión infinita en RLS de tabla alumnos
-- Causa: migration_v19_familias creó políticas que se referencian
--        mutuamente con alumnos → ciclo infinito.
-- Ejecutar en Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 1: VER políticas actuales (diagnóstico, opcional) ───
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'alumnos';

-- ── PASO 2: Eliminar TODAS las políticas actuales de alumnos ──
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'alumnos' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON alumnos', pol.policyname);
  END LOOP;
END $$;

-- ── PASO 3: Recrear la política correcta (sin recursión) ──────
-- Acceso por institución: subquery sobre usuarios (no sobre alumnos).
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alumnos_inst" ON alumnos
FOR ALL TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM usuarios WHERE id = auth.uid()
  )
)
WITH CHECK (
  institucion_id IN (
    SELECT institucion_id FROM usuarios WHERE id = auth.uid()
  )
);

-- ── PASO 4: Corregir RLS en tabla familia_alumnos (si existe) ─
-- La policy original era recursiva: alumnos → familia_alumnos → alumnos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'familia_alumnos'
  ) THEN
    DROP POLICY IF EXISTS "familia_alumnos_select"  ON familia_alumnos;
    DROP POLICY IF EXISTS "familia_alumnos_acceso"  ON familia_alumnos;
    DROP POLICY IF EXISTS "familia_alumnos_inst"    ON familia_alumnos;

    -- Recrear sin subquery a alumnos: el staff accede vía cursos/institución
    EXECUTE $pol$
      CREATE POLICY "familia_alumnos_acceso" ON familia_alumnos
      FOR ALL TO authenticated
      USING (
        familia_id IN (
          SELECT id FROM familias WHERE usuario_id = auth.uid()
        )
        OR
        familia_id IN (
          SELECT fa.id FROM familias fa
          WHERE fa.institucion_id IN (
            SELECT institucion_id FROM usuarios WHERE id = auth.uid()
          )
        )
      )
      WITH CHECK (
        familia_id IN (
          SELECT fa.id FROM familias fa
          WHERE fa.institucion_id IN (
            SELECT institucion_id FROM usuarios WHERE id = auth.uid()
          )
        )
      )
    $pol$;
  END IF;
END $$;

-- ── PASO 5: Corregir RLS en tabla familias (si existe) ────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'familias'
  ) THEN
    DROP POLICY IF EXISTS "familias_select"  ON familias;
    DROP POLICY IF EXISTS "familias_acceso"  ON familias;
    DROP POLICY IF EXISTS "familias_propia"  ON familias;

    EXECUTE $pol$
      CREATE POLICY "familias_acceso" ON familias
      FOR ALL TO authenticated
      USING (
        usuario_id = auth.uid()
        OR
        institucion_id IN (
          SELECT institucion_id FROM usuarios WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        institucion_id IN (
          SELECT institucion_id FROM usuarios WHERE id = auth.uid()
        )
      )
    $pol$;
  END IF;
END $$;

-- ── PASO 6: Recargar schema cache ────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DEL FIX ──────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v31_fix_rls_recursion.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v31: Fix recursión infinita en RLS
--
-- Causa raíz:
--   migration_v30 creó policy en familia_alumno que hace JOIN en cursos.
--   Las policies de v19 (calificaciones_select, materias_estado_acceso)
--   ya consultaban familia_alumno. Esto formó la cadena:
--
--     calificaciones_select
--       → familia_alumno_select (v30)
--         → JOIN alumnos + cursos
--           → cursos RLS
--             → recursión infinita
--
--   El error se traga silenciosamente en auth.js de la app familias,
--   resultando en vinculos=null → ALUMNO_ACTUAL=null → "no tenés alumnos".
--
-- Fixes:
--   1. familia_alumno_select: reemplazar JOIN en cursos por subquery
--      directa en alumnos.institucion_id (sin tocar cursos).
--   2. cursos: resetear cualquier policy recursiva con una limpia.
--
-- Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Fix policy familia_alumno ──────────────────────────────

DROP POLICY IF EXISTS "familia_alumno_select" ON public.familia_alumno;

-- Familias ven sus propios vínculos; staff ve los de su institución
-- Usa alumnos.institucion_id directamente — sin JOIN en cursos
-- para evitar la cadena recursiva a través de cursos RLS.
CREATE POLICY "familia_alumno_select" ON public.familia_alumno
  FOR SELECT TO authenticated
  USING (
    auth.uid() = usuario_id
    OR alumno_id IN (
      SELECT a.id FROM public.alumnos a
      WHERE a.institucion_id = (
        SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
      )
    )
  );

-- ── 2. Fix cursos RLS ─────────────────────────────────────────
-- Eliminar todas las policies actuales de cursos (pueden ser recursivas)
-- y recrear una limpia que solo consulta usuarios.

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'cursos' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cursos', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "cursos_inst" ON public.cursos
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );

-- ── Recargar schema ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v31 ──────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- ARCHIVO: migration_v32_rls_gaps.sql
-- ─────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════
-- Migration v32: RLS gaps — tablas sin protección multi-tenant
--
-- Auditoria detectó 5 tablas con RLS ausente o incompleto:
--   1. materias             → tiene institucion_id, sin policy
--   2. alertas_academicas   → tiene institucion_id, sin policy
--   3. alertas_asistencia   → tiene institucion_id, sin policy
--   4. instancias_evaluativas → tiene institucion_id, sin policy
--   5. suplencias           → sin institucion_id, acceso via titular_id
--
-- Ejecutar en: Supabase → SQL Editor
-- Seguro de re-ejecutar (DROP IF EXISTS antes de cada CREATE)
-- ═══════════════════════════════════════════════════════════════


-- ── 1. materias ───────────────────────────────────────────────

ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materias_inst" ON public.materias;
CREATE POLICY "materias_inst" ON public.materias
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 2. alertas_academicas ─────────────────────────────────────

ALTER TABLE public.alertas_academicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_acad_inst" ON public.alertas_academicas;
CREATE POLICY "alertas_acad_inst" ON public.alertas_academicas
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 3. alertas_asistencia ─────────────────────────────────────

ALTER TABLE public.alertas_asistencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_asist_inst" ON public.alertas_asistencia;
CREATE POLICY "alertas_asist_inst" ON public.alertas_asistencia
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 4. instancias_evaluativas ─────────────────────────────────

ALTER TABLE public.instancias_evaluativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inst_eval_inst" ON public.instancias_evaluativas;
CREATE POLICY "inst_eval_inst" ON public.instancias_evaluativas
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 5. suplencias ─────────────────────────────────────────────
-- No tiene institucion_id directo: el acceso se valida
-- a través del titular (ambas partes deben ser de la misma institución)

ALTER TABLE public.suplencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suplencias_inst" ON public.suplencias;
CREATE POLICY "suplencias_inst" ON public.suplencias
  FOR ALL TO authenticated
  USING (
    titular_id IN (
      SELECT u.id FROM public.usuarios u
      WHERE u.institucion_id = (
        SELECT u2.institucion_id FROM public.usuarios u2 WHERE u2.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    titular_id IN (
      SELECT u.id FROM public.usuarios u
      WHERE u.institucion_id = (
        SELECT u2.institucion_id FROM public.usuarios u2 WHERE u2.id = auth.uid()
      )
    )
  );


-- ── Recargar schema ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v32 ──────────────────────────────────────

