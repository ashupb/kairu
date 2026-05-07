-- ═══════════════════════════════════════════════════════
-- Migration: actividades EOE v3 — RLS para tablas de soporte
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. EOE puede UPDATE sus propias actividades (reuniones con tipo_actividad)
CREATE POLICY "eoe_update_actividades" ON reuniones
  FOR UPDATE USING (
    tipo_actividad IS NOT NULL
    AND institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  )
  WITH CHECK (
    tipo_actividad IS NOT NULL
    AND institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- 2. EOE puede insertar invitados a sus actividades
CREATE POLICY "eoe_insert_reunion_invitados" ON reunion_invitados
  FOR INSERT WITH CHECK (
    reunion_id IN (
      SELECT id FROM reuniones
      WHERE institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    )
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- 3. Cualquier usuario autenticado puede insertar notificaciones para otros usuarios
--    (necesario para EOE, docentes y preceptores que generan notificaciones cruzadas)
CREATE POLICY "auth_insert_notificaciones" ON notificaciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. EOE puede insertar eventos en la agenda institucional
CREATE POLICY "eoe_insert_eventos_institucionales" ON eventos_institucionales
  FOR INSERT WITH CHECK (
    institucion_id = (SELECT institucion_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'eoe'
  );

-- Verificar políticas resultantes con:
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename IN ('reuniones','reunion_invitados','notificaciones','eventos_institucionales')
--   ORDER BY tablename, policyname;
