-- ═══════════════════════════════════════════════════════════════
-- KAIRU — Onboarding nuevo cliente
--
-- Crea una institución nueva con toda la configuración base lista.
-- El director puede ingresar y empezar a cargar datos inmediatamente.
--
-- PASOS:
--   1. Completar las variables en la sección CONFIGURAR ANTES DE EJECUTAR
--   2. Crear el usuario director en Supabase → Authentication → Users
--      (invitar por email o crear manualmente)
--   3. Ejecutar este script en SQL Editor
--
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE

  -- ┌─────────────────────────────────────────────────────────┐
  -- │  CONFIGURAR ANTES DE EJECUTAR                           │
  -- ├─────────────────────────────────────────────────────────┤
  director_email      TEXT := 'EMAIL_DEL_DIRECTOR@ejemplo.com';

  inst_nombre         TEXT := 'NOMBRE DEL COLEGIO';
  inst_localidad      TEXT := 'CIUDAD, PROVINCIA';
  inst_anio_lectivo   INT  := 2026;

  -- Niveles que tiene el colegio (true / false)
  tiene_inicial       BOOL := false;
  tiene_primario      BOOL := true;
  tiene_secundario    BOOL := true;

  -- Escala de calificaciones (solo afecta primario 2do ciclo y secundario)
  --   'numerica'   → notas del 1 al 10
  --   'conceptual' → MB / B / R / I
  escala_calif        TEXT := 'numerica';
  nota_minima         INT  := 7;   -- nota mínima de aprobación
  nota_recuperacion   INT  := 4;   -- nota mínima en instancias de recuperación

  -- Umbrales de alerta de inasistencias (en % de faltas)
  umbral_1            INT  := 10;  -- alerta amarilla
  umbral_2            INT  := 20;  -- alerta naranja
  umbral_3            INT  := 30;  -- alerta roja

  -- ─ NO MODIFICAR LO DE ABAJO ──────────────────────────────
  inst_id             UUID;
  director_uid        UUID;

BEGIN

  -- Buscar el usuario director en Auth
  SELECT id INTO director_uid
  FROM auth.users
  WHERE email = director_email;

  IF director_uid IS NULL THEN
    RAISE EXCEPTION
      'Usuario "%" no encontrado en auth.users. Primero crealo en Supabase → Authentication → Users.',
      director_email;
  END IF;

  -- ── 1. INSTITUCIÓN ───────────────────────────────────────
  INSERT INTO instituciones (
    nombre,
    localidad,
    nivel_inicial,
    nivel_primario,
    nivel_secundario,
    anio_lectivo,
    portal_familias_activo
  ) VALUES (
    inst_nombre,
    inst_localidad,
    tiene_inicial,
    tiene_primario,
    tiene_secundario,
    inst_anio_lectivo,
    false   -- el portal familias se activa aparte cuando esté listo
  )
  RETURNING id INTO inst_id;

  RAISE NOTICE 'Institución creada: % (%)', inst_nombre, inst_id;

  -- ── 2. PERFIL DIRECTOR ───────────────────────────────────
  INSERT INTO usuarios (
    id,
    nombre_completo,
    email,
    rol,
    institucion_id,
    activo
  ) VALUES (
    director_uid,
    'Director — ' || inst_nombre,    -- el director puede editar su nombre desde el perfil
    director_email,
    'director_general',
    inst_id,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    rol            = 'director_general',
    institucion_id = inst_id,
    activo         = true;

  RAISE NOTICE 'Director vinculado: %', director_email;

  -- ── 3. CONFIG ASISTENCIA ─────────────────────────────────
  IF tiene_inicial THEN
    INSERT INTO config_asistencia (
      institucion_id, nivel,
      umbral_alerta_1, umbral_alerta_2, umbral_alerta_3,
      justificadas_cuentan
    ) VALUES (
      inst_id, 'inicial', umbral_1, umbral_2, umbral_3, false
    );
  END IF;

  IF tiene_primario THEN
    INSERT INTO config_asistencia (
      institucion_id, nivel,
      umbral_alerta_1, umbral_alerta_2, umbral_alerta_3,
      justificadas_cuentan,
      escala, nota_minima, nota_recuperacion,
      escala_ciclo1, aprobacion_ciclo1
    ) VALUES (
      inst_id, 'primario', umbral_1, umbral_2, umbral_3, false,
      escala_calif, nota_minima, nota_recuperacion,
      'conceptual', 'B'
    );
  END IF;

  IF tiene_secundario THEN
    INSERT INTO config_asistencia (
      institucion_id, nivel,
      umbral_alerta_1, umbral_alerta_2, umbral_alerta_3,
      justificadas_cuentan,
      escala, nota_minima, nota_recuperacion
    ) VALUES (
      inst_id, 'secundario', umbral_1, umbral_2, umbral_3, false,
      escala_calif, nota_minima, nota_recuperacion
    );
  END IF;

  -- ── 4. TIPOS DE JUSTIFICACIÓN ────────────────────────────
  INSERT INTO tipos_justificacion (institucion_id, nombre, activo) VALUES
    (inst_id, 'Certificado médico',            true),
    (inst_id, 'Turno médico',                  true),
    (inst_id, 'Duelo',                         true),
    (inst_id, 'Razones religiosas',            true),
    (inst_id, 'Actividad deportiva oficial',   true),
    (inst_id, 'Trámite administrativo',        true),
    (inst_id, 'Otra causa justificada',        true);

  -- ── 5. TIPOS DE PROBLEMÁTICAS ────────────────────────────
  INSERT INTO tipos_problematicas (institucion_id, nombre, activo, orden) VALUES
    (inst_id, 'Dificultad de aprendizaje',        true,  1),
    (inst_id, 'Problema de conducta',             true,  2),
    (inst_id, 'Situación familiar',               true,  3),
    (inst_id, 'Bullying / conflicto entre pares', true,  4),
    (inst_id, 'Ausentismo reiterado',             true,  5),
    (inst_id, 'Vulnerabilidad social',            true,  6),
    (inst_id, 'Otro',                             true, 99);

  -- ── 6. TIPOS DE INTERVENCIÓN EOE ─────────────────────────
  INSERT INTO tipos_intervencion (institucion_id, nombre, activo, orden) VALUES
    (inst_id, 'Entrevista con el alumno',  true,  1),
    (inst_id, 'Entrevista con la familia', true,  2),
    (inst_id, 'Reunión con docentes',      true,  3),
    (inst_id, 'Derivación',               true,  4),
    (inst_id, 'Seguimiento',              true,  5),
    (inst_id, 'Otra intervención',         true, 99);

  -- ── 7. TIPOS DE INSTANCIA EVALUATIVA ─────────────────────
  -- Instancias de calificación para secundaria (configurables desde la app)
  INSERT INTO tipos_instancia_evaluativa (institucion_id, nombre, orden, activo, es_recuperatorio) VALUES
    (inst_id, 'Trabajo práctico',    1, true, false),
    (inst_id, 'Evaluación escrita',  2, true, false),
    (inst_id, 'Evaluación oral',     3, true, false),
    (inst_id, 'Proyecto',            4, true, false),
    (inst_id, 'Recuperatorio',       5, true, true);

  -- ── RESULTADO ────────────────────────────────────────────
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE 'Onboarding completado exitosamente.';
  RAISE NOTICE '  Institución : %', inst_nombre;
  RAISE NOTICE '  ID          : %', inst_id;
  RAISE NOTICE '  Director    : %', director_email;
  RAISE NOTICE '  Niveles     : inicial=% primario=% secundario=%',
    tiene_inicial, tiene_primario, tiene_secundario;
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE 'Próximos pasos desde la app:';
  RAISE NOTICE '  1. El director ingresa con su email/contraseña';
  RAISE NOTICE '  2. Crear cursos en Configuración → Cursos';
  RAISE NOTICE '  3. Invitar docentes y preceptores';
  RAISE NOTICE '  4. Cargar alumnos por curso';
  RAISE NOTICE '══════════════════════════════════════════════════';

END;
$$;
