-- ═══════════════════════════════════════════════════════════════
-- Migration v38: Roles, permisos y administrador de plataforma
-- (SPEC definitivo — roles, permisos y super_admin)
--
-- Hace TODO sin pasos manuales de dashboard:
--   1. Roles reales: secretario / vicedirector (ya no son alias de
--      directivo_nivel en el front) y super_admin (reemplaza al rol
--      huérfano 'admin').
--   2. Tabla roles_permisos + semillas por institución + trigger para
--      instituciones nuevas.
--   3. is_super_admin() y policies aditivas para que el administrador de
--      plataforma cruce instituciones.
--
-- Ejecutar en: Supabase → SQL Editor → New Query
-- Idempotente: seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  ÚNICO INPUT HUMANO — email del administrador de plataforma ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Este usuario pasa a ser super_admin: deja de pertenecer a una institución
-- (institucion_id = NULL) y accede a todas mediante el selector de la topbar.
--
--     EMAIL:  aperezbenary@gmail.com
--
-- Es una cuenta que YA EXISTE: no se crea nada ni se define contraseña alguna.
-- Se entra con el mismo email y la misma contraseña de siempre; sólo cambia
-- el rol. Ningún otro usuario se toca (no hay DELETE en esta migración).
--
-- Por qué esta cuenta: la institución demo tiene además
-- directorgeneral@demo.kairu como director_general, así que al promover ésta
-- la institución NO se queda sin administrador (sigue en el listado de
-- Usuarios y sigue recibiendo las notificaciones dirigidas a director_general).
-- Para probar la experiencia de directora, entrar con directorgeneral@demo.kairu.
--
-- Si el email no existe, la migración NO falla: avisa por NOTICE y no promueve
-- a nadie. Para designar otra cuenta después, usar
-- migrations/promover_super_admin.sql.


-- ═══════════════════════════════════════════════════════════════
-- 1. is_super_admin()
-- ═══════════════════════════════════════════════════════════════
-- SECURITY DEFINER obligatorio: si una policy consulta `usuarios` sin esto,
-- se dispara recursión infinita de RLS (mismo bug que arregló la v31 en
-- cursos / familia_alumno). Al ser DEFINER, la consulta interna no re-evalúa
-- las policies de usuarios.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 2. usuarios: institucion_id nullable + rol admin → super_admin
-- ═══════════════════════════════════════════════════════════════
-- El super_admin no pertenece a ninguna institución (§5.1).
ALTER TABLE public.usuarios ALTER COLUMN institucion_id DROP NOT NULL;

-- El rol 'admin' era huérfano (no asignable desde la UI). Se renombra.
UPDATE public.usuarios SET rol = 'super_admin' WHERE rol = 'admin';

-- Promover la cuenta de la dueña de la plataforma (ver cabecera).
DO $$
DECLARE
  v_email text := 'aperezbenary@gmail.com';   -- ← ÚNICO INPUT HUMANO
  v_id    uuid;
BEGIN
  SELECT id INTO v_id FROM public.usuarios WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'v38: no existe un usuario con email % — no se creó super_admin. Creá la cuenta y volvé a correr esta migración.', v_email;
  ELSE
    UPDATE public.usuarios
       SET rol = 'super_admin',
           institucion_id = NULL,
           activo = true,
           en_licencia = false
     WHERE id = v_id;
    RAISE NOTICE 'v38: usuario % promovido a super_admin.', v_email;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 3. Tabla roles_permisos
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.roles_permisos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  rol            text NOT NULL,
  modulo_id      text NOT NULL,
  ver            boolean NOT NULL DEFAULT false,
  editar         boolean NOT NULL DEFAULT false,
  eliminar       boolean NOT NULL DEFAULT false,
  UNIQUE (institucion_id, rol, modulo_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_permisos_inst ON public.roles_permisos (institucion_id);
CREATE INDEX IF NOT EXISTS idx_roles_permisos_lookup ON public.roles_permisos (institucion_id, rol);

ALTER TABLE public.roles_permisos ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario de la institución (la app necesita leer su plantilla).
DROP POLICY IF EXISTS "roles_permisos_select" ON public.roles_permisos;
CREATE POLICY "roles_permisos_select" ON public.roles_permisos
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR institucion_id IN (SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid())
  );

-- Escritura: solo director_general de esa institución (o super_admin).
DROP POLICY IF EXISTS "roles_permisos_write" ON public.roles_permisos;
CREATE POLICY "roles_permisos_write" ON public.roles_permisos
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'director_general'
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'director_general'
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- 4. Semillas — defaults que replican el comportamiento actual
-- ═══════════════════════════════════════════════════════════════
-- `ver` replica NAV_CONFIG; `editar`/`eliminar` replican los arrays de rol de
-- cada módulo. secretario y vicedirector se siembran idénticos a
-- directivo_nivel. super_admin NO se siembra: nunca pasa por esta tabla.
CREATE OR REPLACE FUNCTION public.seed_roles_permisos(p_institucion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol      text;
  v_modulo   text;
  v_ver      boolean;
  v_editar   boolean;
  v_eliminar boolean;

  -- Módulos gobernados por la tabla (ids del nav)
  v_modulos text[] := ARRAY[
    'dash','agenda','novedades','comunicados','msgfam','prob','obj','eoe',
    'asist','notas','intensif','informes','leg','admin'
  ];

  -- ver
  v_ver_director   text[] := ARRAY['dash','agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','admin'];
  v_ver_directivo  text[] := ARRAY['dash','agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','admin'];
  v_ver_eoe        text[] := ARRAY['dash','msgfam','prob','obj','eoe','asist','notas','intensif','leg'];
  v_ver_preceptor  text[] := ARRAY['dash','agenda','novedades','comunicados','msgfam','prob','obj','asist','notas','intensif','leg','admin'];
  v_ver_docente    text[] := ARRAY['dash','agenda','msgfam','prob','obj','asist','notas','intensif','informes'];

  -- editar
  v_ed_director   text[] := ARRAY['agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','admin'];
  v_ed_directivo  text[] := ARRAY['agenda','novedades','comunicados','msgfam','prob','obj','eoe','asist','notas','intensif','informes','leg','admin'];
  v_ed_eoe        text[] := ARRAY['msgfam','prob','obj','eoe','leg'];
  v_ed_preceptor  text[] := ARRAY['agenda','novedades','comunicados','msgfam','prob','asist','notas','intensif','leg','admin'];
  v_ed_docente    text[] := ARRAY['msgfam','prob','asist','notas','intensif','informes'];

  -- eliminar
  v_el_director   text[] := ARRAY['agenda','novedades','comunicados','prob','obj','eoe','asist','notas','intensif','leg','admin'];
  v_el_directivo  text[] := ARRAY['agenda','novedades','comunicados','prob','obj','eoe','asist','notas','intensif','admin'];
  v_el_eoe        text[] := ARRAY['eoe'];
  v_el_preceptor  text[] := ARRAY['agenda'];
  v_el_docente    text[] := ARRAY[]::text[];
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['director_general','directivo_nivel','vicedirector','secretario','eoe','preceptor','docente'] LOOP
    FOREACH v_modulo IN ARRAY v_modulos LOOP

      -- secretario y vicedirector comparten los defaults de directivo_nivel
      IF v_rol = 'director_general' THEN
        v_ver := v_modulo = ANY(v_ver_director);
        v_editar := v_modulo = ANY(v_ed_director);
        v_eliminar := v_modulo = ANY(v_el_director);
      ELSIF v_rol IN ('directivo_nivel','vicedirector','secretario') THEN
        v_ver := v_modulo = ANY(v_ver_directivo);
        v_editar := v_modulo = ANY(v_ed_directivo);
        v_eliminar := v_modulo = ANY(v_el_directivo);
      ELSIF v_rol = 'eoe' THEN
        v_ver := v_modulo = ANY(v_ver_eoe);
        v_editar := v_modulo = ANY(v_ed_eoe);
        v_eliminar := v_modulo = ANY(v_el_eoe);
      ELSIF v_rol = 'preceptor' THEN
        v_ver := v_modulo = ANY(v_ver_preceptor);
        v_editar := v_modulo = ANY(v_ed_preceptor);
        v_eliminar := v_modulo = ANY(v_el_preceptor);
      ELSE -- docente
        v_ver := v_modulo = ANY(v_ver_docente);
        v_editar := v_modulo = ANY(v_ed_docente);
        v_eliminar := v_modulo = ANY(v_el_docente);
      END IF;

      -- ON CONFLICT DO NOTHING: no pisa lo que la institución ya haya editado.
      INSERT INTO public.roles_permisos (institucion_id, rol, modulo_id, ver, editar, eliminar)
      VALUES (p_institucion_id, v_rol, v_modulo, v_ver, v_editar, v_eliminar)
      ON CONFLICT (institucion_id, rol, modulo_id) DO NOTHING;

    END LOOP;
  END LOOP;
END $$;

-- Sembrar todas las instituciones existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.instituciones LOOP
    PERFORM public.seed_roles_permisos(r.id);
  END LOOP;
END $$;

-- Sembrar automáticamente las instituciones nuevas
CREATE OR REPLACE FUNCTION public.trg_seed_roles_permisos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_roles_permisos(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS instituciones_seed_permisos ON public.instituciones;
CREATE TRIGGER instituciones_seed_permisos
  AFTER INSERT ON public.instituciones
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_roles_permisos();


-- ═══════════════════════════════════════════════════════════════
-- 5. Acceso multi-institución del super_admin
-- ═══════════════════════════════════════════════════════════════
-- En Postgres las policies PERMISIVAS se combinan con OR. En vez de reescribir
-- las ~80 policies existentes (v19–v37, varias redefinidas y algunas creadas a
-- mano en el dashboard, fuera del repo), se AGREGA una policy por tabla que
-- sólo habilita al super_admin. Ninguna policy existente se toca, es
-- idempotente y cubre también las que no están versionadas acá.
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'instituciones','usuarios','cursos','alumnos','materias','asignaciones',
    'asistencia','calificaciones','instancias_evaluativas','instancias_calificacion',
    'tipos_instancia_evaluativa','periodos_evaluativos','periodos_intensificacion',
    'materias_estado_alumno','cierres_periodo','alertas_academicas','alertas_asistencia',
    'problematicas','problematica_alumnos','intervenciones','tipos_problematicas',
    'tipos_intervencion','derivaciones','objetivos','reuniones','reunion_invitados',
    'actividad_encuentros','eventos_institucionales','evento_respuestas','notificaciones',
    'observaciones_iniciales','informes_iniciales','config_asistencia','tipos_justificacion',
    'dias_no_lectivos','suplencias','comunicados','comunicado_imagenes','comunicado_lecturas',
    'mensajes_familia','familia_alumno','tareas_usuario','roles_permisos'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    -- Saltear tablas que no existan en este esquema
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'v38: tabla % no existe, se saltea.', t;
      CONTINUE;
    END IF;

    -- ⚠ NO habilitar RLS acá. Si una tabla hoy tiene RLS DESACTIVADO está
    -- abierta a todos los usuarios autenticados; activarla dejando sólo la
    -- policy de super_admin dejaría AFUERA a todos los usuarios normales.
    -- En esas tablas el super_admin ya ve todo, así que no hay nada que hacer.
    -- Sólo se agrega la policy donde RLS ya está activo y por lo tanto está
    -- filtrando por institución.
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity
    ) THEN
      RAISE NOTICE 'v38: % no tiene RLS activo — se saltea (ya es accesible).', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_super_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())',
      t || '_super_admin', t
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- Recargar schema de PostgREST
-- ═══════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v38 ──────────────────────────────────────
