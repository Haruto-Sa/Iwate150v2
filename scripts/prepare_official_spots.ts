import officialSpots from "../src/data/official-spots.json";

/**
 * 手動レビュー用SQL文字列を安全に引用する。
 * @param value - 固定データの文字列
 * @returns SQL文字列リテラル
 * @example quote("御所野遺跡");
 */
function quote(value: string): string { return "'" + value.replaceAll("'", "''") + "'"; }

// 接続・実行はしない。出力は必ずROLLBACKで終わる。適用する場合はレビュー後に末尾をCOMMITへ変更する。
console.log(`-- Issue #9: official-spots.json から生成。実行前に対象DBと出力をレビューする。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.cities, public.genres, public.spots IN SHARE ROW EXCLUSIVE MODE;
DO $import$
DECLARE city_key integer; genre_key integer; duplicate_count integer;
BEGIN
${officialSpots.map(spot => `
  -- ${spot.name}: ${spot.sourceUrl} (確認 ${spot.verifiedOn})
  SELECT id INTO STRICT city_key FROM public.cities WHERE name = ${quote(spot.city)};
  SELECT id INTO STRICT genre_key FROM public.genres WHERE name = ${quote(spot.genre)};
  SELECT count(*) INTO duplicate_count FROM public.spots
    WHERE city_id = city_key AND (
      position(${quote(spot.name)} in name) > 0 OR (length(name) > 0 AND position(name in ${quote(spot.name)}) > 0)
      OR position(${quote(spot.referenceUrl.replace(/\/$/, ""))} in coalesce(reference_url, '')) > 0
      OR position(${quote(spot.sourceUrl.replace(/\/$/, ""))} in coalesce(reference_url, '')) > 0
    );
  IF duplicate_count > 1 THEN
    RAISE EXCEPTION 'Ambiguous existing spot: %', ${quote(spot.name)};
  ELSIF duplicate_count = 0 THEN
    INSERT INTO public.spots (name, description, city_id, genre_id, lat, lng, image_path, image_thumb_path, model_path, reference_url)
    VALUES (${quote(spot.name)}, ${quote(spot.description)}, city_key, genre_key, ${spot.lat}, ${spot.lng}, NULL, NULL, NULL, ${quote(spot.referenceUrl)});
  END IF;
`).join("")}
END $import$;
SELECT s.id, s.name, c.name AS city, g.name AS genre, s.lat, s.lng, s.reference_url
  FROM public.spots s JOIN public.cities c ON c.id = s.city_id JOIN public.genres g ON g.id = s.genre_id
  WHERE s.name IN (${officialSpots.map(spot => quote(spot.name)).join(", ")});
ROLLBACK;
`);
