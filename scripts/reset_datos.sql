-- =============================================================
-- RESET DATOS — Kairu Demo
-- Borra datos de alumnos, asistencia, notas, actividades EOE
-- y registros transaccionales.
-- CONSERVA: institución, usuarios, tipos y configuración.
--
-- Usar cuando: la institución ya está configurada pero se
-- quiere limpiar los datos para volver a cargar desde cero.
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    -- Nivel 1: hojas sin dependientes
    'actividad_encuentros',
    'reunion_invitados',
    'evento_respuestas',
    'problematica_alumnos',
    'objetivo_hitos',
    'objetivo_incidentes',
    'instancias_calificacion',
    'alertas_academicas',
    'alertas_asistencia',
    'alertas_problematicas',
    'contactos_alumno',
    'documentacion_alumno',
    'historial_cursos',
    'observaciones_legajo',
    'suplencias',
    'intervenciones',
    'intervenciones_eoe',
    'derivaciones',
    'materias_estado_alumno',
    'asistencia',
    'asistencias',
    'notificaciones',
    'cierres_curso_cuatrimestre',
    'cierres_materia_cuatrimestre',
    'cierres_periodo',
    'periodos_intensificacion',
    'periodos_evaluativos',
    'calificaciones',
    'instancias_evaluativas',
    -- Nivel 2: dependen de lo anterior
    'objetivos',
    'reuniones',
    'problematicas',
    'eventos_institucionales',
    'calendario_curso',
    'dias_no_lectivos',
    'asignaciones',
    'docente_cursos',
    'config_calificaciones',
    -- Nivel 3: estructura académica
    'alumnos',
    'cursos',
    'materias'
    -- NO incluye: tipos_*, config_asistencia, orientaciones,
    --             usuarios, instituciones
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DELETE FROM %I', t);
      RAISE NOTICE 'OK: %', t;
    ELSE
      RAISE NOTICE 'No existe (ok): %', t;
    END IF;
  END LOOP;
END;
$$;

COMMIT;

SELECT 'Reset de datos completado. Institución, usuarios y configuración conservados.' AS resultado;
