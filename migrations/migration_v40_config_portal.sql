-- ═══════════════════════════════════════════════════════════════
-- Migration v40: Configuración del Portal Familiar
--
--   1. config_portal    → políticas del portal (una fila por institución).
--   2. usuarios.ultimo_acceso → para el panel "quién entró y quién no".
--   3. Filas de roles_permisos para `familias` y `portal_general`.
--
-- Requiere v38 (roles_permisos, is_super_admin) y v39 (Apps) ya corridas.
-- Ejecutar en: Supabase → SQL Editor → New Query
-- Idempotente: seguro de re-ejecutar. Sin pasos manuales de dashboard.
--
-- ⚠ notas_visibles arranca en 'inmediato' en TODAS las instituciones, para que
-- el portal se comporte exactamente igual que hoy (las familias siguen viendo
-- las notas apenas se cargan). Cambiarlo a 'al_cierre' es una decisión que se
-- toma desde Configuración → Portal Familiar → General.
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. usuarios.ultimo_acceso
-- ═══════════════════════════════════════════════════════════════
-- Se actualiza en el login de ambas apps. Si es NULL, la app usa
-- debe_cambiar_password como respaldo para saber si la persona ya ingresó.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso timestamptz;


-- ═══════════════════════════════════════════════════════════════
-- 2. config_portal
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.config_portal (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id          uuid NOT NULL UNIQUE REFERENCES public.instituciones(id) ON DELETE CASCADE,
  notas_visibles          text NOT NULL DEFAULT 'inmediato',   -- 'inmediato' | 'al_cierre'
  familias_pueden_iniciar boolean NOT NULL DEFAULT true,
  mensaje_bienvenida      text
);

-- Valores admitidos de notas_visibles
DO $$
BEGIN
  ALTER TABLE public.config_portal DROP CONSTRAINT IF EXISTS config_portal_notas_visibles_check;
  ALTER TABLE public.config_portal
    ADD CONSTRAINT config_portal_notas_visibles_check
    CHECK (notas_visibles IN ('inmediato', 'al_cierre'));
END $$;

ALTER TABLE public.config_portal ENABLE ROW LEVEL SECURITY;

-- Lectura: staff Y familias de la institución. La app de familias necesita
-- leer la visibilidad de notas y el mensaje de bienvenida.
DROP POLICY IF EXISTS "config_portal_select" ON public.config_portal;
CREATE POLICY "config_portal_select" ON public.config_portal
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR institucion_id IN (SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid())
  );

-- Escritura: los roles que administran el portal.
DROP POLICY IF EXISTS "config_portal_write" ON public.config_portal;
CREATE POLICY "config_portal_write" ON public.config_portal
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('director_general','directivo_nivel','secretario','vicedirector','preceptor')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.rol IN ('director_general','directivo_nivel','secretario','vicedirector','preceptor')
    )
  );

DROP POLICY IF EXISTS "config_portal_super_admin" ON public.config_portal;
CREATE POLICY "config_portal_super_admin" ON public.config_portal
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


-- ═══════════════════════════════════════════════════════════════
-- 3. Semillas por institución
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.seed_config_portal(p_institucion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  -- Una fila por institución, con los defaults (= comportamiento actual).
  INSERT INTO public.config_portal (institucion_id)
  VALUES (p_institucion_id)
  ON CONFLICT (institucion_id) DO NOTHING;

  -- Permisos de las dos subsecciones del Portal Familiar. Default = los roles
  -- que ya tenían acceso; docente y eoe quedan fuera.
  FOREACH v_rol IN ARRAY ARRAY['director_general','directivo_nivel','vicedirector','secretario','eoe','preceptor','docente'] LOOP
    INSERT INTO public.roles_permisos (institucion_id, rol, modulo_id, ver, editar, eliminar)
    VALUES (
      p_institucion_id, v_rol, 'familias',
      v_rol IN ('director_general','directivo_nivel','secretario','vicedirector','preceptor'),
      v_rol IN ('director_general','directivo_nivel','secretario','vicedirector','preceptor'),
      v_rol IN ('director_general','directivo_nivel','secretario','vicedirector','preceptor')
    )
    ON CONFLICT (institucion_id, rol, modulo_id) DO NOTHING;

    INSERT INTO public.roles_permisos (institucion_id, rol, modulo_id, ver, editar, eliminar)
    VALUES (
      p_institucion_id, v_rol, 'portal_general',
      v_rol IN ('director_general','directivo_nivel','secretario','vicedirector','preceptor'),
      v_rol IN ('director_general','directivo_nivel','secretario','vicedirector','preceptor'),
      false
    )
    ON CONFLICT (institucion_id, rol, modulo_id) DO NOTHING;
  END LOOP;
END $$;

-- Sembrar todas las instituciones existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.instituciones LOOP
    PERFORM public.seed_config_portal(r.id);
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 4. Semilla automática para instituciones nuevas
-- ═══════════════════════════════════════════════════════════════
-- Se extiende la función del trigger creado en la v38 (y ampliado en la v39).
CREATE OR REPLACE FUNCTION public.trg_seed_roles_permisos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_roles_permisos(NEW.id);
  PERFORM public.seed_apps_capacidades(NEW.id);
  PERFORM public.seed_config_portal(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS instituciones_seed_permisos ON public.instituciones;
CREATE TRIGGER instituciones_seed_permisos
  AFTER INSERT ON public.instituciones
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_roles_permisos();


-- ═══════════════════════════════════════════════════════════════
-- Recargar schema de PostgREST
-- ═══════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v40 ──────────────────────────────────────
