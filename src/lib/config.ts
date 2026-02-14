export const APP_TITLE = "Iwate150";
export const APP_TAGLINE = "Transparent Atlas of Iwate";

// Map settings (Leaflet / OSM)
export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const IWATE_CENTER = { lat: 39.7036, lng: 141.1527 };
export const MORIOKA_STATION = { lat: 39.7017, lng: 141.1365 };

// ---------------------------------------------------------------------------
// Route provider settings（ルートプロバイダ設定）
// ---------------------------------------------------------------------------

/**
 * ルートプロバイダの設定オブジェクト
 *
 * - defaultMode: アプリ起動時のデフォルトモード
 * - openRouteServiceApiKey: OpenRouteService の API キー（有料プロバイダ用）
 *   環境変数 `NEXT_PUBLIC_ORS_API_KEY` から取得。未設定時は無料 (OSRM) へフォールバック。
 */
export const ROUTE_CONFIG = {
  /** デフォルトのルートモード */
  defaultMode: "free" as "free" | "paid",
  /** OpenRouteService API キー（NEXT_PUBLIC_ORS_API_KEY） */
  openRouteServiceApiKey: process.env.NEXT_PUBLIC_ORS_API_KEY ?? "",
} as const;
