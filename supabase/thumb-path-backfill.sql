-- Backfill thumbnail path columns from existing image_path values.
-- Convention:
--   full:  images/<category>/<name>.<ext>
--   thumb: images/thumb/<category>/<name>.<ext>
--
-- This migration keeps original extension. The upload script mirrors files
-- to `images/thumb/...` paths so verify can pass immediately.

update public.cities
set image_thumb_path = regexp_replace(image_path, '^images/', 'images/thumb/')
where image_thumb_path is null
  and image_path like 'images/%';

update public.cities
set image_thumb_path = regexp_replace(image_thumb_path, '^images/thumb/', 'images/thumb/')
where image_thumb_path like 'images/thumb/%';

update public.genres
set image_thumb_path = regexp_replace(image_path, '^images/', 'images/thumb/')
where image_thumb_path is null
  and image_path like 'images/%';

update public.genres
set image_thumb_path = regexp_replace(image_thumb_path, '^images/thumb/', 'images/thumb/')
where image_thumb_path like 'images/thumb/%';

update public.spots
set image_thumb_path = regexp_replace(image_path, '^images/', 'images/thumb/')
where image_thumb_path is null
  and image_path like 'images/%';

update public.spots
set image_thumb_path = regexp_replace(image_thumb_path, '^images/thumb/', 'images/thumb/')
where image_thumb_path like 'images/thumb/%';
