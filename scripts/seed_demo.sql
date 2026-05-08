-- =============================================================
-- SEED DEMO — Kairu
-- Crea la institución demo y vincula el usuario admin.
-- Ejecutar DESPUÉS de reset_total.sql
--
-- Qué hace:
--   1. Crea "Institución Educativa Kairú"
--   2. Vincula el perfil admin al usuario de Auth existente
--   3. Crea config de asistencia para los 3 niveles
--   4. Carga tipos de justificación, problemáticas e intervenciones
--
-- Ejecutar en: Supabase → SQL Editor
-- =============================================================

DO $$
DECLARE
  inst_id   UUID;
  admin_uid UUID;
BEGIN

  -- Buscar el usuario admin en Auth por email
  SELECT id INTO admin_uid
  FROM auth.users
  WHERE email = 'aperezbenary@gmail.com';

  IF admin_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario admin no encontrado en auth.users. Verificar el email en este script.';
  END IF;

  -- ── 1. INSTITUCIÓN ───────────────────────────────────────
  INSERT INTO instituciones (
    nombre,
    nivel_inicial,
    nivel_primario,
    nivel_secundario,
    anio_lectivo
  ) VALUES (
    'Institución Educativa Kairú',
    true,
    true,
    true,
    2026
  )
  RETURNING id INTO inst_id;

  RAISE NOTICE 'Institución creada: %', inst_id;

  -- ── 2. PERFIL ADMIN ──────────────────────────────────────
  INSERT INTO usuarios (
    id,
    nombre_completo,
    email,
    rol,
    institucion_id,
    activo
  ) VALUES (
    admin_uid,
    'Administrador Kairú',
    'aperezbenary@gmail.com',
    'director_general',
    inst_id,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    rol            = 'director_general',
    institucion_id = inst_id,
    activo         = true;

  RAISE NOTICE 'Perfil admin vinculado: %', admin_uid;

  -- ── 3. CONFIG ASISTENCIA (valores por defecto) ───────────
  INSERT INTO config_asistencia (
    institucion_id, nivel,
    umbral_alerta_1, umbral_alerta_2, umbral_alerta_3,
    justificadas_cuentan
  ) VALUES
    (inst_id, 'inicial',    10, 20, 30, false),
    (inst_id, 'primario',   10, 20, 30, false),
    (inst_id, 'secundario', 10, 20, 30, false);

  -- ── 4. TIPOS DE JUSTIFICACIÓN ────────────────────────────
  INSERT INTO tipos_justificacion (institucion_id, nombre) VALUES
    (inst_id, 'Certificado médico'),
    (inst_id, 'Turno médico'),
    (inst_id, 'Duelo'),
    (inst_id, 'Razones religiosas'),
    (inst_id, 'Actividad deportiva oficial'),
    (inst_id, 'Trámite administrativo');

  -- ── 5. TIPOS DE PROBLEMÁTICAS ────────────────────────────
  INSERT INTO tipos_problematicas (institucion_id, nombre, activo, orden) VALUES
    (inst_id, 'Dificultad de aprendizaje',        true, 1),
    (inst_id, 'Problema de conducta',             true, 2),
    (inst_id, 'Situación familiar',               true, 3),
    (inst_id, 'Bullying / conflicto entre pares', true, 4),
    (inst_id, 'Ausentismo reiterado',             true, 5),
    (inst_id, 'Otro',                             true, 99);

  -- ── 6. TIPOS DE INTERVENCIÓN EOE ─────────────────────────
  INSERT INTO tipos_intervencion (institucion_id, nombre, activo, orden) VALUES
    (inst_id, 'Entrevista con el alumno',  true, 1),
    (inst_id, 'Entrevista con la familia', true, 2),
    (inst_id, 'Reunión con docentes',      true, 3),
    (inst_id, 'Derivación',               true, 4),
    (inst_id, 'Seguimiento',              true, 5),
    (inst_id, 'Otra intervención',         true, 99);

  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE 'Seed completado.';
  RAISE NOTICE 'Institución ID : %', inst_id;
  RAISE NOTICE 'Admin UUID     : %', admin_uid;
  RAISE NOTICE 'Ingresar con   : aperezbenary@gmail.com';
  RAISE NOTICE '─────────────────────────────────────────────';

END;
$$;

SELECT 'Seed demo completado. Revisá los NOTICE de arriba para confirmar los IDs.' AS resultado;
