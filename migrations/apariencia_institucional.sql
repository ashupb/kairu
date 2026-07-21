-- =====================================================
-- Apariencia institucional: color de marca (logo_url ya existe)
-- Ejecutar en: Supabase → SQL Editor → New Query
-- =====================================================

-- Color de marca elegido por la institución (hex, ej: '#229957').
-- Si es null, la app usa el verde por defecto de Kairú.
alter table instituciones add column if not exists tema_color text;

-- ─────────────────────────────────────────────────────
-- Logo institucional (columna instituciones.logo_url — YA EXISTE, no requiere
-- migración). Para que la subida de logo funcione hace falta crear el bucket
-- de Storage una única vez, a mano, desde el dashboard de Supabase:
--
--   1. Supabase → Storage → New bucket
--      - Nombre: institucion-assets
--      - Public bucket: SÍ (los logos se muestran en el sidebar de todos
--        los usuarios de la institución, no hace falta URL firmada)
--
-- No hace falta configurar políticas RLS especiales: el mismo criterio que
-- ya se usa en el bucket "comunicados" (creado del mismo modo, sin RLS
-- propia) — el botón de subir logo solo se muestra a director_general en
-- el cliente, igual que el resto de las acciones administrativas de esta app.
-- =====================================================
