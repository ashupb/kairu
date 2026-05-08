-- =============================================================
-- RESET TOTAL — Kairu Demo
-- Borra TODOS los datos: alumnos, actividades, institución,
-- usuarios (perfiles) y configuración.
-- La cuenta de Auth (email/contraseña) NO se toca.
--
-- Usar cuando: se quiere empezar absolutamente desde cero.
-- Ejecutar en: Supabase → SQL Editor
-- Seguir con:  seed_demo.sql
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
    'materias',
    -- Nivel 4: configuración por institución
    'tipos_evaluacion',
    'tipos_evento',
    'tipos_instancia_evaluativa',
    'tipos_intervencion',
    'tipos_justificacion',
    'tipos_problematicas',
    'config_asistencia',
    'orientaciones',
    -- Nivel 5: raíz
    'usuarios',
    'instituciones'
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

SELECT 'Reset total completado. Ejecutar seed_demo.sql para configurar la demo.' AS resultado;
