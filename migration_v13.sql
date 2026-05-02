-- ═══════════════════════════════════════════════════════
-- Migration v13: Recalcular total_faltas en alertas_asistencia
-- Corrige registros stale generados antes del fix de duplicados
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── CONTEXTO ────────────────────────────────────────
-- Antes del fix v12, la tabla asistencia tenía duplicados por el
-- comportamiento NULL != NULL del UNIQUE constraint. Esto generó
-- alertas con total_faltas inflado (ej: 10 en vez de 7.5).
-- Esta migración recalcula total_faltas para todos los alumnos
-- usando solo registros diarios (hora_clase IS NULL) deduplicados
-- por fecha (conservando el más reciente).
-- ─────────────────────────────────────────────────────

UPDATE alertas_asistencia aa
SET total_faltas = sub.total
FROM (
  SELECT
    alumno_id,
    SUM(
      CASE estado
        WHEN 'ausente'     THEN 1.0
        WHEN 'media_falta' THEN 0.5
        WHEN 'tardanza'    THEN 0.25
        ELSE 0
      END
    ) AS total
  FROM (
    SELECT DISTINCT ON (alumno_id, fecha)
      alumno_id, estado
    FROM asistencia
    WHERE hora_clase IS NULL
    ORDER BY alumno_id, fecha, created_at DESC NULLS LAST, id DESC
  ) deduped
  GROUP BY alumno_id
) sub
WHERE aa.alumno_id = sub.alumno_id
  AND aa.total_faltas IS DISTINCT FROM sub.total;

-- Recargar schema cache
NOTIFY pgrst, 'reload schema';

-- ── FIN DE MIGRACIÓN v13 ──────────────────────────────
