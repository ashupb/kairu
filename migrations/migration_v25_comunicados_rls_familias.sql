-- ════════════════════════════════════════════════════════════════
-- v25 — RLS: permitir que usuarios familia lean comunicados
--
-- Los usuarios con rol='familia' están en la tabla usuarios con
-- institucion_id. Sin embargo, si la policy de comunicados excluye
-- implícitamente a ese rol, las novedades no aparecen en la app.
--
-- Esta migración agrega una política de lectura explícita que cubre
-- a TODOS los usuarios autenticados de la institución (staff + familia).
-- Las políticas de escritura siguen siendo solo para staff.
--
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas de lectura previas para evitar duplicados
DROP POLICY IF EXISTS "comunicados_select"        ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_read"          ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_familia_read"  ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_inst"          ON public.comunicados;

-- Lectura: cualquier usuario autenticado de la institución (incluye familia)
CREATE POLICY "comunicados_select" ON public.comunicados
FOR SELECT TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios WHERE id = auth.uid()
  )
);

-- Escritura: solo staff (roles que no son 'familia')
DROP POLICY IF EXISTS "comunicados_write"        ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_write"  ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_insert" ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_update" ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_staff_delete" ON public.comunicados;

CREATE POLICY "comunicados_staff_insert" ON public.comunicados
FOR INSERT TO authenticated
WITH CHECK (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "comunicados_staff_update" ON public.comunicados
FOR UPDATE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "comunicados_staff_delete" ON public.comunicados
FOR DELETE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v25 ──────────────────────────────────────────
