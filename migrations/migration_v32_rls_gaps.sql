-- ═══════════════════════════════════════════════════════════════
-- Migration v32: RLS gaps — tablas sin protección multi-tenant
--
-- Auditoria detectó 5 tablas con RLS ausente o incompleto:
--   1. materias             → tiene institucion_id, sin policy
--   2. alertas_academicas   → tiene institucion_id, sin policy
--   3. alertas_asistencia   → tiene institucion_id, sin policy
--   4. instancias_evaluativas → tiene institucion_id, sin policy
--   5. suplencias           → sin institucion_id, acceso via titular_id
--
-- Ejecutar en: Supabase → SQL Editor
-- Seguro de re-ejecutar (DROP IF EXISTS antes de cada CREATE)
-- ═══════════════════════════════════════════════════════════════


-- ── 1. materias ───────────────────────────────────────────────

ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materias_inst" ON public.materias;
CREATE POLICY "materias_inst" ON public.materias
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 2. alertas_academicas ─────────────────────────────────────

ALTER TABLE public.alertas_academicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_acad_inst" ON public.alertas_academicas;
CREATE POLICY "alertas_acad_inst" ON public.alertas_academicas
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 3. alertas_asistencia ─────────────────────────────────────

ALTER TABLE public.alertas_asistencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_asist_inst" ON public.alertas_asistencia;
CREATE POLICY "alertas_asist_inst" ON public.alertas_asistencia
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 4. instancias_evaluativas ─────────────────────────────────

ALTER TABLE public.instancias_evaluativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inst_eval_inst" ON public.instancias_evaluativas;
CREATE POLICY "inst_eval_inst" ON public.instancias_evaluativas
  FOR ALL TO authenticated
  USING (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institucion_id IN (
      SELECT u.institucion_id FROM public.usuarios u WHERE u.id = auth.uid()
    )
  );


-- ── 5. suplencias ─────────────────────────────────────────────
-- No tiene institucion_id directo: el acceso se valida
-- a través del titular (ambas partes deben ser de la misma institución)

ALTER TABLE public.suplencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suplencias_inst" ON public.suplencias;
CREATE POLICY "suplencias_inst" ON public.suplencias
  FOR ALL TO authenticated
  USING (
    titular_id IN (
      SELECT u.id FROM public.usuarios u
      WHERE u.institucion_id = (
        SELECT u2.institucion_id FROM public.usuarios u2 WHERE u2.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    titular_id IN (
      SELECT u.id FROM public.usuarios u
      WHERE u.institucion_id = (
        SELECT u2.institucion_id FROM public.usuarios u2 WHERE u2.id = auth.uid()
      )
    )
  );


-- ── Recargar schema ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v32 ──────────────────────────────────────
