-- ═══════════════════════════════════════════════════════════════
-- Promover una cuenta existente a administrador de plataforma
--
-- Usalo cuando creaste la cuenta DESPUÉS de correr migration_v38, o cuando
-- quieras designar otro administrador de plataforma.
--
-- Requisito: la migración v38 ya corrida (define el rol y las policies).
-- Seguro de re-ejecutar.
-- ═══════════════════════════════════════════════════════════════

-- ── PASO 1 (opcional) — ver qué cuentas hay y con qué rol ──────
--   select email, rol, nivel, activo, institucion_id
--   from usuarios order by rol, email;

-- ── PASO 2 — promover ─────────────────────────────────────────
-- Editá v_email con la cuenta que querés como administradora de plataforma.
-- La cuenta ya tiene que existir: NO se crea nada acá ni se define ninguna
-- contraseña. Se entra con el email y la contraseña que esa cuenta ya tenía.
--
-- ⚠ Antes de promover, verificá que la institución quede con al menos otro
-- director_general (el super_admin deja de ser un actor institucional: sale
-- del listado de Usuarios y deja de recibir sus notificaciones). Con el PASO 1
-- lo ves de un vistazo.
--
-- Si necesitás una cuenta nueva, creala primero desde la app:
--   Configuración → Usuarios → Nuevo usuario → modo "Contraseña temporal"
-- (el rol que le pongas da igual, se pisa acá). Recordá que en Supabase Auth
-- los emails son únicos: no podés reusar el de una cuenta existente. Un alias
-- tipo tuemail+admin@gmail.com llega a la misma casilla y sirve como cuenta
-- aparte.

DO $$
DECLARE
  v_email text := 'aperezbenary@gmail.com';   -- ← EDITAR
  v_id    uuid;
BEGIN
  SELECT id INTO v_id FROM public.usuarios WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No existe ningún usuario con email %. Creá la cuenta desde la app y volvé a correr esto.', v_email;
  END IF;

  UPDATE public.usuarios
     SET rol            = 'super_admin',
         institucion_id = NULL,   -- no es un actor institucional
         activo         = true,
         en_licencia    = false
   WHERE id = v_id;

  RAISE NOTICE 'Listo: % es ahora administrador de plataforma. Entrá con ese email y la contraseña que definiste.', v_email;
END $$;

-- ── Para revertir (volver a hacerla usuaria institucional) ─────
--   update usuarios
--      set rol = 'director_general',
--          institucion_id = (select id from instituciones order by nombre limit 1)
--    where lower(email) = lower('aperezbenary@gmail.com');
