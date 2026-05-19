-- ═══════════════════════════════════════════════════════════════
-- Migration v30: RLS para notificaciones + lectura de familia_alumno
--
-- 1. notificaciones: SELECT y UPDATE propios (para que familias puedan
--    leer sus notificaciones y marcarlas como leídas).
-- 2. familia_alumno: SELECT para staff autenticado (para que la app
--    interna pueda encontrar los usuarios-familia de un alumno y
--    enviarles notificaciones de cita).
--
-- Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── notificaciones ────────────────────────────────────────────────

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: cada usuario ve solo sus propias notificaciones
DROP POLICY IF EXISTS "notif_own_select" ON public.notificaciones;
CREATE POLICY "notif_own_select" ON public.notificaciones
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);

-- UPDATE: cada usuario puede actualizar solo sus propias notificaciones
--         (para marcar leida = true)
DROP POLICY IF EXISTS "notif_own_update" ON public.notificaciones;
CREATE POLICY "notif_own_update" ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id);

-- INSERT: cualquier usuario autenticado puede insertar (ya existía, idempotente)
DROP POLICY IF EXISTS "auth_insert_notificaciones" ON public.notificaciones;
CREATE POLICY "auth_insert_notificaciones" ON public.notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── familia_alumno ────────────────────────────────────────────────

ALTER TABLE public.familia_alumno ENABLE ROW LEVEL SECURITY;

-- SELECT: familias ven sus propios vínculos; staff ve los de su institución
DROP POLICY IF EXISTS "familia_alumno_select" ON public.familia_alumno;
CREATE POLICY "familia_alumno_select" ON public.familia_alumno
  FOR SELECT TO authenticated
  USING (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM public.alumnos a
      JOIN public.cursos c ON c.id = a.curso_id
      WHERE a.id = alumno_id
        AND c.institucion_id = (SELECT institucion_id FROM public.usuarios WHERE id = auth.uid())
    )
  );

-- Recargar schema de PostgREST
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v30 ──────────────────────────────────────────
