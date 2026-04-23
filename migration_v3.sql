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
