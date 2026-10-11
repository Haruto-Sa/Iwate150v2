/** Google Mapsの外部ルート検索URLを生成する。 */

/** 地理座標（度）。 */
export type LatLng = { lat: number; lng: number };

/** 座標を検証したURL生成結果。 */
export type RouteUrlResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * 緯度・経度が有限値かつ地理座標の範囲内かを確認する。
 * @param point - 検証対象の座標
 * @returns 有効な座標ならtrue
 * @example isValidCoordinates({ lat: 39.7, lng: 141.1 });
 */
function isValidCoordinates(point: LatLng): boolean {
  return Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
}

/**
 * 現在地の有無にかかわらずGoogle Mapsのルート検索を開くURLを生成する。
 * 出発地を省略した場合はGoogle Maps側に入力・現在地の扱いを委ねる。
 * @param destination - 目的地の座標
 * @param origin - 取得済みの現在地。未取得時はnullまたは省略
 * @returns 検証済みのURL、または遷移を中止するためのエラー
 * @example buildGoogleMapsUrl({ lat: 39.8, lng: 141.2 }, { lat: 39.7, lng: 141.1 });
 */
export function buildGoogleMapsUrl(destination: LatLng, origin: LatLng | null = null): RouteUrlResult {
  if (!isValidCoordinates(destination)) {
    return { ok: false, error: "目的地の座標が不正なため、ルート検索を開けません。" };
  }
  if (origin !== null && !isValidCoordinates(origin)) {
    return { ok: false, error: "現在地の座標が不正です。位置情報を更新してお試しください。" };
  }
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  if (origin !== null) url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  return { ok: true, url: url.href };
}
