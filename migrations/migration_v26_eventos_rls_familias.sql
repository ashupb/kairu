-- ════════════════════════════════════════════════════════════════
-- v26 — RLS: permitir que usuarios familia lean eventos_institucionales
--
-- Si la tabla tiene RLS activado sin política para el rol 'familia',
-- la query de la app de familias devuelve vacío silenciosamente.
-- Esta migración agrega una política de lectura que cubre a todos
-- los usuarios autenticados de la institución (staff + familia).
--
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.eventos_institucionales ENABLE ROW LEVEL SECURITY;

-- Eliminar política previa si existe
DROP POLICY IF EXISTS "eventos_select"         ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_read"           ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_familia_read"   ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_inst"           ON public.eventos_institucionales;

-- Lectura: cualquier usuario autenticado de la institución (incluye familia)
CREATE POLICY "eventos_select" ON public.eventos_institucionales
FOR SELECT TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios WHERE id = auth.uid()
  )
);

-- Escritura: solo staff (roles que no son 'familia')
DROP POLICY IF EXISTS "eventos_staff_insert" ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_staff_update" ON public.eventos_institucionales;
DROP POLICY IF EXISTS "eventos_staff_delete" ON public.eventos_institucionales;

CREATE POLICY "eventos_staff_insert" ON public.eventos_institucionales
FOR INSERT TO authenticated
WITH CHECK (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "eventos_staff_update" ON public.eventos_institucionales
FOR UPDATE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

CREATE POLICY "eventos_staff_delete" ON public.eventos_institucionales
FOR DELETE TO authenticated
USING (
  institucion_id IN (
    SELECT institucion_id FROM public.usuarios
    WHERE id = auth.uid() AND rol != 'familia'
  )
);

NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v26 ──────────────────────────────────────────
