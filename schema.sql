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
  tipo text check (tipo in ('convivencia','emocional','familiar','aprendizaje','salud','conducta','otro')),
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
  tipo text check (tipo in ('entrevista_alumno','reunion_familia','derivacion','llamado','reunion_equipo','otro')),
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



