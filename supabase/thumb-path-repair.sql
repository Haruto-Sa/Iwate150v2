-- Repair existing image_thumb_path values that were forced to .webp.
-- Recompute from image_path using original extension.

update public.cities
set image_thumb_path = regexp_replace(image_path, '^images/', 'images/thumb/')
where image_path like 'images/%';

update public.genres
set image_thumb_path = regexp_replace(image_path, '^images/', 'images/thumb/')
where image_path like 'images/%';

update public.spots
set image_thumb_path = regexp_replace(image_path, '^images/', 'images/thumb/')
where image_path like 'images/%';
