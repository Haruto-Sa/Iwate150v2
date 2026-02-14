-- Normalize image/model paths to Storage-relative paths for Iwate150.
-- Handles:
--   1) legacy leading-slash paths (/images/*, /models/*)
--   2) full storage URLs (https://<project>.supabase.co/storage/v1/object/public/<bucket>/*)
-- Output:
--   images/*
--   models/*

-- 1) leading slash normalization
update public.cities
set image_path = regexp_replace(image_path, '^/', '')
where image_path like '/images/%';

update public.cities
set image_thumb_path = regexp_replace(image_thumb_path, '^/', '')
where image_thumb_path like '/images/%';

update public.genres
set image_path = regexp_replace(image_path, '^/', '')
where image_path like '/images/%';

update public.genres
set image_thumb_path = regexp_replace(image_thumb_path, '^/', '')
where image_thumb_path like '/images/%';

update public.spots
set image_path = regexp_replace(image_path, '^/', '')
where image_path like '/images/%';

update public.spots
set image_thumb_path = regexp_replace(image_thumb_path, '^/', '')
where image_thumb_path like '/images/%';

update public.spots
set model_path = regexp_replace(model_path, '^/', '')
where model_path like '/models/%';

-- 2) full storage URL normalization (iwate150data / public bucket both対応)
update public.cities
set image_path = regexp_replace(image_path, '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/', '')
where image_path ~ '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/';

update public.cities
set image_thumb_path = regexp_replace(image_thumb_path, '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/', '')
where image_thumb_path ~ '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/';

update public.genres
set image_path = regexp_replace(image_path, '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/', '')
where image_path ~ '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/';

update public.genres
set image_thumb_path = regexp_replace(image_thumb_path, '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/', '')
where image_thumb_path ~ '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/';

update public.spots
set image_path = regexp_replace(image_path, '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/', '')
where image_path ~ '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/';

update public.spots
set image_thumb_path = regexp_replace(image_thumb_path, '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/', '')
where image_thumb_path ~ '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/';

update public.spots
set model_path = regexp_replace(model_path, '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/', '')
where model_path ~ '^https?://[^/]+/storage/v1/object/public/(iwate150data|public)/';
