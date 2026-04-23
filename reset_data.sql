-- =====================================================
-- EduGestión · Reset completo de datos
-- Borra todos los datos operativos en orden FK-safe.
-- Ignora tablas que aún no existen.
-- Conserva: instituciones + usuario admin.
-- =====================================================

do $$
begin

  -- ── Nivel más profundo (dependen de todo) ──────────
  begin delete from calificaciones;         exception when undefined_table then null; end;
  begin delete from instancias_evaluativas; exception when undefined_table then null; end;
  begin delete from alertas_asistencia;     exception when undefined_table then null; end;
  begin delete from alertas_academicas;     exception when undefined_table then null; end;
  begin delete from asistencia;             exception when undefined_table then null; end;
  begin delete from asistencias;            exception when undefined_table then null; end;
  begin delete from evento_respuestas;      exception when undefined_table then null; end;
  begin delete from observaciones_legajo;   exception when undefined_table then null; end;
  begin delete from objetivo_incidentes;    exception when undefined_table then null; end;
  begin delete from objetivo_hitos;         exception when undefined_table then null; end;

  -- ── Nivel medio ────────────────────────────────────
  begin delete from objetivos;              exception when undefined_table then null; end;
  begin delete from problematicas;          exception when undefined_table then null; end;
  begin delete from notificaciones;         exception when undefined_table then null; end;
  begin delete from eventos_institucionales; exception when undefined_table then null; end;
  begin delete from calendario_curso;       exception when undefined_table then null; end;
  begin delete from docente_cursos;         exception when undefined_table then null; end;
  begin delete from asignaciones;           exception when undefined_table then null; end;
  begin delete from alumnos;                exception when undefined_table then null; end;

  -- ── Cursos antes de orientaciones (FK cursos→orientaciones) ──
  begin delete from cursos;                 exception when undefined_table then null; end;
  begin delete from materias;               exception when undefined_table then null; end;
  begin delete from orientaciones;          exception when undefined_table then null; end;

  -- ── Parámetros ─────────────────────────────────────
  begin delete from config_asistencia;      exception when undefined_table then null; end;
  begin delete from config_calificaciones;  exception when undefined_table then null; end;
  begin delete from tipos_evaluacion;       exception when undefined_table then null; end;
  begin delete from tipos_justificacion;    exception when undefined_table then null; end;
  begin delete from tipos_evento;           exception when undefined_table then null; end;
  begin delete from periodos_evaluativos;   exception when undefined_table then null; end;

end $$;

-- ── Usuarios: borrar todos excepto el admin ──────────
-- (CASCADE en auth.users → public.usuarios limpia ambas)
delete from auth.users
  where email != 'aperezbenary@gmail.com';

-- ── Guardia: si public.usuarios del admin se borró por CASCADE accidental,
--    lo recrea automáticamente desde auth.users ─────────
insert into public.usuarios (id, email, nombre_completo, username, rol, activo, institucion_id)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'nombre_completo', 'Administrador Kairu'),
  coalesce(au.raw_user_meta_data->>'username', 'aperezbenary'),
  'director_general',
  true,
  (select id from instituciones limit 1)
from auth.users au
where au.email = 'aperezbenary@gmail.com'
on conflict (id) do nothing;

-- ── Verificación ─────────────────────────────────────
select 'auth.users'      as tabla, count(*) as filas from auth.users
union all
select 'public.usuarios' as tabla, count(*) as filas from public.usuarios
union all
select 'cursos'          as tabla, count(*) as filas from cursos
union all
select 'alumnos'         as tabla, count(*) as filas from alumnos
union all
select 'asignaciones'    as tabla, count(*) as filas from asignaciones;
