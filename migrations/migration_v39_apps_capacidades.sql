-- ═══════════════════════════════════════════════════════════════
-- Migration v39: Apps (módulos por institución) + capacidades sensibles
--
--   1. modulos_institucion  → qué módulos usa cada institución.
--   2. roles_capacidades    → permisos finos que la matriz de módulos no
--                             puede expresar (quedó pendiente de la v38).
--   3. Filas de roles_permisos para el módulo `tareas`, que no existía
--      cuando la v38 sembró las plantillas.
--
-- Requiere migration_v38_roles_permisos.sql ya corrida.
-- Ejecutar en: Supabase → SQL Editor → New Query
-- Idempotente: seguro de re-ejecutar. Sin pasos manuales de dashboard.
--
-- FALLBACK (importante): la ausencia de una fila significa ACTIVO / default,
-- nunca "apagado". Si algo de esto no corriera, la app se comporta igual que
-- antes en vez de esconder módulos.
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. modulos_institucion
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.modulos_institucion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  modulo_id      text NOT NULL,
  activo         boolean NOT NULL DEFAULT true,
  UNIQUE (institucion_id, modulo_id)
);

CREATE INDEX IF NOT EXISTS idx_modulos_inst ON public.modulos_institucion (institucion_id);

ALTER TABLE public.modulos_institucion ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario de la institución. Incluye a las FAMILIAS: la app
-- de familias lee esta tabla para filtrar su propio menú.
DROP POLICY IF EXISTS "modulos_inst_select" ON public.modulos_institucion;
CREATE POLICY "modulos_inst_select" ON public.modulos_institucion
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR institucion_id IN (SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid())
  );

-- Escritura: solo director_general de esa institución (o super_admin).
DROP POLICY IF EXISTS "modulos_inst_write" ON public.modulos_institucion;
CREATE POLICY "modulos_inst_write" ON public.modulos_institucion
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

DROP POLICY IF EXISTS "modulos_institucion_super_admin" ON public.modulos_institucion;
CREATE POLICY "modulos_institucion_super_admin" ON public.modulos_institucion
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


-- ═══════════════════════════════════════════════════════════════
-- 2. roles_capacidades
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.roles_capacidades (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  rol            text NOT NULL,
  capacidad      text NOT NULL,
  habilitada     boolean NOT NULL DEFAULT false,
  UNIQUE (institucion_id, rol, capacidad)
);

CREATE INDEX IF NOT EXISTS idx_roles_cap_inst ON public.roles_capacidades (institucion_id);
CREATE INDEX IF NOT EXISTS idx_roles_cap_lookup ON public.roles_capacidades (institucion_id, rol);

ALTER TABLE public.roles_capacidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_cap_select" ON public.roles_capacidades;
CREATE POLICY "roles_cap_select" ON public.roles_capacidades
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR institucion_id IN (SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS "roles_cap_write" ON public.roles_capacidades;
CREATE POLICY "roles_cap_write" ON public.roles_capacidades
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

DROP POLICY IF EXISTS "roles_capacidades_super_admin" ON public.roles_capacidades;
CREATE POLICY "roles_capacidades_super_admin" ON public.roles_capacidades
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


-- ═══════════════════════════════════════════════════════════════
-- 3. Semillas por institución
-- ═══════════════════════════════════════════════════════════════
-- Módulos: TODO en true (la app se ve igual que antes de esta migración).
-- Capacidades: replican los arrays de rol que ya existen en el código.
-- Además siembra las filas de roles_permisos del módulo `tareas`, que la v38
-- no conocía.
CREATE OR REPLACE FUNCTION public.seed_apps_capacidades(p_institucion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modulo text;
  v_rol    text;
  v_cap    text;

  -- Módulos internos + maestro del portal + secciones de la app de familias
  v_modulos text[] := ARRAY[
    'agenda','novedades','comunicados','msgfam','prob','obj','eoe',
    'asist','notas','intensif','informes','leg','tareas',
    'portal',
    'portal_novedades','portal_comunicados','portal_mensajes','portal_seguimiento',
    'portal_asistencia','portal_agenda','portal_convocatorias'
  ];

  -- Defaults de capacidades (replican el comportamiento actual del código)
  v_cap_obs      text[] := ARRAY['eoe','director_general','directivo_nivel','secretario','vicedirector'];
  v_cap_calif    text[] := ARRAY['director_general','directivo_nivel','secretario','vicedirector','preceptor','docente'];
  v_cap_cierre   text[] := ARRAY['director_general','directivo_nivel','secretario','vicedirector'];
  v_cap_alumnos  text[] := ARRAY['director_general','directivo_nivel','secretario','vicedirector','preceptor'];
  v_cap_usuarios text[] := ARRAY['director_general','directivo_nivel','secretario','vicedirector'];
  v_cap_roles    text[] := ARRAY['director_general'];
BEGIN
  -- ── Módulos: todos activos ──
  FOREACH v_modulo IN ARRAY v_modulos LOOP
    INSERT INTO public.modulos_institucion (institucion_id, modulo_id, activo)
    VALUES (p_institucion_id, v_modulo, true)
    ON CONFLICT (institucion_id, modulo_id) DO NOTHING;  -- no pisa lo ya configurado
  END LOOP;

  -- ── Capacidades por rol ──
  FOREACH v_rol IN ARRAY ARRAY['director_general','directivo_nivel','vicedirector','secretario','eoe','preceptor','docente'] LOOP
    FOREACH v_cap IN ARRAY ARRAY['ver_obs_privadas_eoe','cargar_calificaciones','cerrar_periodos','gestionar_alumnos','gestionar_usuarios','editar_roles_permisos'] LOOP
      INSERT INTO public.roles_capacidades (institucion_id, rol, capacidad, habilitada)
      VALUES (
        p_institucion_id, v_rol, v_cap,
        CASE v_cap
          WHEN 'ver_obs_privadas_eoe'  THEN v_rol = ANY(v_cap_obs)
          WHEN 'cargar_calificaciones' THEN v_rol = ANY(v_cap_calif)
          WHEN 'cerrar_periodos'       THEN v_rol = ANY(v_cap_cierre)
          WHEN 'gestionar_alumnos'     THEN v_rol = ANY(v_cap_alumnos)
          WHEN 'gestionar_usuarios'    THEN v_rol = ANY(v_cap_usuarios)
          WHEN 'editar_roles_permisos' THEN v_rol = ANY(v_cap_roles)
          ELSE false
        END
      )
      ON CONFLICT (institucion_id, rol, capacidad) DO NOTHING;
    END LOOP;
  END LOOP;

  -- ── roles_permisos para el módulo `tareas` (no existía en la v38) ──
  -- Tareas es personal y la RLS de tareas_usuario ya la acota a
  -- usuario_id = auth.uid(), así que todos los roles pueden todo.
  FOREACH v_rol IN ARRAY ARRAY['director_general','directivo_nivel','vicedirector','secretario','eoe','preceptor','docente'] LOOP
    INSERT INTO public.roles_permisos (institucion_id, rol, modulo_id, ver, editar, eliminar)
    VALUES (p_institucion_id, v_rol, 'tareas', true, true, true)
    ON CONFLICT (institucion_id, rol, modulo_id) DO NOTHING;
  END LOOP;
END $$;

-- Sembrar todas las instituciones existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.instituciones LOOP
    PERFORM public.seed_apps_capacidades(r.id);
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 4. Semilla automática para instituciones nuevas
-- ═══════════════════════════════════════════════════════════════
-- La v38 ya creó un trigger que siembra roles_permisos. Se reemplaza su función
-- para que además siembre módulos y capacidades, así una institución nueva
-- queda completa sin intervención.
CREATE OR REPLACE FUNCTION public.trg_seed_roles_permisos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_roles_permisos(NEW.id);
  PERFORM public.seed_apps_capacidades(NEW.id);
  RETURN NEW;
END $$;

-- (El trigger instituciones_seed_permisos de la v38 ya apunta a esta función.)
DROP TRIGGER IF EXISTS instituciones_seed_permisos ON public.instituciones;
CREATE TRIGGER instituciones_seed_permisos
  AFTER INSERT ON public.instituciones
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_roles_permisos();


-- ═══════════════════════════════════════════════════════════════
-- Recargar schema de PostgREST
-- ═══════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v39 ──────────────────────────────────────
