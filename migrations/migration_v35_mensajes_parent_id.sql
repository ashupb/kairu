-- ════════════════════════════════════════════════════════════════
-- v35 — Mensajes familia: parent_id para threading de respuestas
--
-- Agrega parent_id a mensajes_familia para vincular respuestas
-- con el mensaje original. Las respuestas de la familia quedan
-- anidadas visualmente bajo el mensaje de la institución.
--
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.mensajes_familia
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.mensajes_familia(id);

CREATE INDEX IF NOT EXISTS idx_mensajes_familia_parent
  ON public.mensajes_familia(parent_id);

NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v35 ──────────────────────────────────────────
