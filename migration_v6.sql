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
