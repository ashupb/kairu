-- ════════════════════════════════════════════════
-- v23 — Tabla comunicado_imagenes
-- Soporte para múltiples imágenes por comunicado
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.comunicado_imagenes (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id uuid        NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  imagen_url    text        NOT NULL,
  orden         integer     NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comunicado_imagenes_com_idx
  ON public.comunicado_imagenes(comunicado_id, orden);

ALTER TABLE public.comunicado_imagenes ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer imágenes
-- (el filtro de institución aplica en la query del comunicado padre)
CREATE POLICY "imagenes_select" ON public.comunicado_imagenes
  FOR SELECT TO authenticated USING (true);

-- Solo usuarios internos (directivos) insertan; la app lo controla
CREATE POLICY "imagenes_insert" ON public.comunicado_imagenes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Solo usuarios internos eliminan; la app lo controla
CREATE POLICY "imagenes_delete" ON public.comunicado_imagenes
  FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
