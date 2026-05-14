-- ════════════════════════════════════════════════
-- v22 — Tabla comunicado_lecturas
-- Registra qué familiar leyó qué comunicado
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.comunicado_lecturas (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id uuid        NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  usuario_id    uuid        NOT NULL,
  leido_at      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT comunicado_lecturas_uq UNIQUE (comunicado_id, usuario_id)
);

-- RLS: cada usuario solo puede ver y crear sus propias lecturas
ALTER TABLE public.comunicado_lecturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecturas_propias_select" ON public.comunicado_lecturas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "lecturas_propias_insert" ON public.comunicado_lecturas
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

NOTIFY pgrst, 'reload schema';
