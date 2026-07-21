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
-- IMPORTANTE — corrección respecto a la primera versión de este archivo:
-- "Public bucket" solo habilita la LECTURA anónima (la URL pública de
-- getPublicUrl funciona sin políticas). La SUBIDA sigue pasando por RLS de
-- storage.objects, así que sin políticas de INSERT el upload falla con un
-- error de "row-level security policy". Correr esto después de crear el
-- bucket (reemplaza el supuesto anterior de que no hacían falta políticas):
-- =====================================================

create policy "institucion_assets_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'institucion-assets');

create policy "institucion_assets_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'institucion-assets');

create policy "institucion_assets_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'institucion-assets');
