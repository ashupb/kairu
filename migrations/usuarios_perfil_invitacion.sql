-- =====================================================
-- Usuarios: perfil completo + creación por invitación
-- (SPEC_usuarios_perfil_creacion.md)
-- Ejecutar en: Supabase → SQL Editor → New Query
-- =====================================================

-- ─── 1. PERFIL COMPLETO ──────────────────────────────
-- Foto de perfil. Respaldo: avatar_iniciales (ya existe) cuando no hay foto.
-- Se sube al bucket institucion-assets, subcarpeta avatars/ (ver nota de Storage abajo).
alter table usuarios add column if not exists avatar_url text;

-- Fecha de nacimiento (para el nice-to-have de "cumpleaños del equipo").
alter table usuarios add column if not exists fecha_nacimiento date;

-- Fecha de ingreso a la institución.
alter table usuarios add column if not exists fecha_ingreso date;

-- ─── 2. FLUJO DE CONTRASEÑA ──────────────────────────
-- Marca que el usuario fue creado con contraseña temporal (fallback sin invitación
-- por email) y debe definir una contraseña propia en el primer ingreso. Los usuarios
-- creados por invitación (inviteUserByEmail) NO lo llevan: ya definen su contraseña
-- desde el link del email. Se limpia (false) cuando el usuario guarda su contraseña.
alter table usuarios add column if not exists debe_cambiar_password boolean not null default false;

-- =====================================================
-- STORAGE — fotos de perfil (NO requiere bucket nuevo)
-- =====================================================
-- Decisión: las fotos de perfil reutilizan el bucket "institucion-assets" que ya
-- existe (el mismo del logo institucional), bajo la subcarpeta avatars/. Las
-- políticas RLS de storage.objects de ese bucket (ver
-- migrations/apariencia_institucional.sql) ya permiten INSERT/UPDATE/DELETE a
-- usuarios authenticated, así que NO hace falta crear bucket ni políticas nuevas.
-- Path usado por la app: avatars/<institucion_id>/<timestamp>.png
--
-- Si en el futuro se quisiera un bucket dedicado, replicar el patrón de
-- apariencia_institucional.sql. Por ahora, nada que correr acá.

-- =====================================================
-- CONFIGURACIÓN EN EL DASHBOARD DE SUPABASE (la hace Ayelen — NO es SQL)
-- =====================================================
-- El flujo de invitación por email y el "¿olvidaste tu contraseña?" necesitan
-- estos pasos de dashboard. Hasta que estén hechos, usar el modo "contraseña
-- temporal" en el alta de usuarios (el modal ofrece ambos).
--
-- 1) SMTP propio  (Authentication → SMTP Settings)
--    Configurar un proveedor real (ej. Resend) con dominio verificado (SPF/DKIM)
--    y remitente branded. El SMTP por defecto de Supabase está limitado (pocos
--    mails/hora, sin branding) y NO sirve para producción.
--
-- 2) Email Templates  (Authentication → Email Templates)
--    Personalizar "Invite user" y "Reset Password" con el copy de Kairú.
--    Usar {{ .ConfirmationURL }} en el botón. Borrador de invitación:
--
--      Asunto: Te damos la bienvenida a Kairú — activá tu cuenta
--      Hola,
--      Te invitaron a Kairú, la plataforma de gestión escolar.
--      Para empezar, creá tu contraseña:
--      [Activar mi cuenta] → {{ .ConfirmationURL }}
--      El enlace vence en 24 horas. Si no esperabas este correo, ignoralo.
--
-- 3) Redirect URLs  (Authentication → URL Configuration → Redirect URLs)
--    Agregar al allowlist la URL de la app interna donde vive la pantalla
--    set-password (dominio de Cloudflare Pages de la app interna). La app pasa
--    como redirect_to su propia URL base (window.location.origin + pathname);
--    Supabase le agrega el hash con el token. Ej:
--      https://<app-interna>.pages.dev/
--      https://<app-interna>.pages.dev/index.html
--
-- 4) Expiración del link  (Authentication → ... según versión del dashboard)
--    Invitación / recovery con vencimiento razonable (ej. 24 h / 86400 s).
