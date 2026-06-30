-- ════════════════════════════════════════════════════════════════
-- v34 — Mensajes familia: canal bidireccional institución ↔ familia
--
-- Una conversación por alumno (hilo cronológico único).
--
-- Reglas de routing (resueltas por la app, no por el usuario):
--   - Institución → familia: cualquier actor institucional puede
--     escribir (enviado_por_id = quien escribe, destinatario_id = NULL).
--   - Familia → mensaje NUEVO: solo puede ir al preceptor del curso
--     del alumno (destinatario_id = cursos.preceptor_id).
--   - Familia → RESPUESTA a un mensaje de la institución: va dirigido
--     a quien envió ese mensaje (destinatario_id = enviado_por_id del
--     mensaje original).
--
-- Acuse de recibo: leido_familia / leido_institucion son flags
-- explícitos, no implícitos por abrir el hilo (la familia debe tocar
-- "Marcar como leído" o "Responder").
--
-- Ejecutar en: Supabase SQL Editor
-- Seguro de re-ejecutar (DROP IF EXISTS antes de cada CREATE POLICY)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mensajes_familia (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institucion_id        uuid NOT NULL REFERENCES public.instituciones(id),
  alumno_id             uuid NOT NULL REFERENCES public.alumnos(id),

  enviado_por_id        uuid REFERENCES public.usuarios(id),   -- NULL si lo envía la familia
  enviado_por_tipo      text NOT NULL CHECK (enviado_por_tipo IN ('institucion','familia')),

  -- A quién va dirigido del lado institución (solo se usa en mensajes de familia)
  destinatario_id       uuid REFERENCES public.usuarios(id),

  cuerpo                text NOT NULL,

  leido_familia         boolean NOT NULL DEFAULT false,
  leido_familia_en      timestamptz,
  leido_institucion     boolean NOT NULL DEFAULT false,
  leido_institucion_en  timestamptz,

  requiere_respuesta    boolean NOT NULL DEFAULT false,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_familia_alumno ON public.mensajes_familia(alumno_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mensajes_familia_dest   ON public.mensajes_familia(destinatario_id, leido_institucion);
CREATE INDEX IF NOT EXISTS idx_mensajes_familia_inst   ON public.mensajes_familia(institucion_id);

ALTER TABLE public.mensajes_familia ENABLE ROW LEVEL SECURITY;

-- ── SELECT ──────────────────────────────────────────────────────

-- Familia: solo mensajes de los alumnos vinculados a su cuenta
DROP POLICY IF EXISTS "msgfam_select_familia" ON public.mensajes_familia;
CREATE POLICY "msgfam_select_familia" ON public.mensajes_familia
FOR SELECT TO authenticated
USING (
  alumno_id IN (
    SELECT fa.alumno_id FROM public.familia_alumno fa WHERE fa.usuario_id = auth.uid()
  )
);

-- Staff: mensajes de su institución (la app filtra por curso/destinatario según rol)
DROP POLICY IF EXISTS "msgfam_select_staff" ON public.mensajes_familia;
CREATE POLICY "msgfam_select_staff" ON public.mensajes_familia
FOR SELECT TO authenticated
USING (
  institucion_id IN (
    SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol != 'familia'
  )
);

-- ── INSERT ──────────────────────────────────────────────────────

-- Familia: solo en nombre propio, sobre alumnos vinculados a su cuenta
DROP POLICY IF EXISTS "msgfam_insert_familia" ON public.mensajes_familia;
CREATE POLICY "msgfam_insert_familia" ON public.mensajes_familia
FOR INSERT TO authenticated
WITH CHECK (
  enviado_por_tipo = 'familia'
  AND enviado_por_id IS NULL
  AND alumno_id IN (
    SELECT fa.alumno_id FROM public.familia_alumno fa WHERE fa.usuario_id = auth.uid()
  )
  AND institucion_id IN (
    SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
  )
);

-- Staff: solo en nombre propio
DROP POLICY IF EXISTS "msgfam_insert_staff" ON public.mensajes_familia;
CREATE POLICY "msgfam_insert_staff" ON public.mensajes_familia
FOR INSERT TO authenticated
WITH CHECK (
  enviado_por_tipo = 'institucion'
  AND enviado_por_id = auth.uid()
  AND institucion_id IN (
    SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol != 'familia'
  )
);

-- ── UPDATE (acuse de recibo / marcar leído) ──────────────────────

-- Familia: puede marcar como leídos los mensajes de la institución hacia sus alumnos
DROP POLICY IF EXISTS "msgfam_update_familia" ON public.mensajes_familia;
CREATE POLICY "msgfam_update_familia" ON public.mensajes_familia
FOR UPDATE TO authenticated
USING (
  alumno_id IN (
    SELECT fa.alumno_id FROM public.familia_alumno fa WHERE fa.usuario_id = auth.uid()
  )
)
WITH CHECK (
  alumno_id IN (
    SELECT fa.alumno_id FROM public.familia_alumno fa WHERE fa.usuario_id = auth.uid()
  )
);

-- Staff: puede marcar como leídos los mensajes de familias de su institución
DROP POLICY IF EXISTS "msgfam_update_staff" ON public.mensajes_familia;
CREATE POLICY "msgfam_update_staff" ON public.mensajes_familia
FOR UPDATE TO authenticated
USING (
  institucion_id IN (
    SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol != 'familia'
  )
)
WITH CHECK (
  institucion_id IN (
    SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol != 'familia'
  )
);

NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v34 ──────────────────────────────────────────
