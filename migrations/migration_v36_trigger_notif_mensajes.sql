-- ════════════════════════════════════════════════════════════════
-- v36 — Trigger: notificación automática cuando la familia escribe
--
-- Dispara al INSERT en mensajes_familia. Si la familia envía un
-- mensaje y hay un destinatario_id asignado (preceptor u otro
-- actor institucional), inserta automáticamente una notificación
-- en la tabla notificaciones para ese usuario.
--
-- Ejecutar en: Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_notif_mensaje_familia()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_alumno_nombre text;
  v_msg           text;
BEGIN
  IF NEW.enviado_por_tipo = 'familia' AND NEW.destinatario_id IS NOT NULL THEN
    SELECT nombre || ' ' || apellido INTO v_alumno_nombre
    FROM public.alumnos WHERE id = NEW.alumno_id;

    v_msg := 'Mensaje de la familia de '
             || coalesce(v_alumno_nombre, 'un alumno')
             || ': '
             || left(NEW.cuerpo, 80)
             || CASE WHEN length(NEW.cuerpo) > 80 THEN '…' ELSE '' END;

    INSERT INTO public.notificaciones
      (usuario_id, tipo, referencia_tabla, referencia_id, leida, mensaje)
    VALUES
      (NEW.destinatario_id, 'mensaje_familia', 'mensajes_familia', NEW.id, false, v_msg);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notif_mensaje_familia ON public.mensajes_familia;
CREATE TRIGGER trigger_notif_mensaje_familia
  AFTER INSERT ON public.mensajes_familia
  FOR EACH ROW EXECUTE FUNCTION fn_notif_mensaje_familia();

-- ── FIN DE MIGRACIÓN v36 ──────────────────────────────────────────
