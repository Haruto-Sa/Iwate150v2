export const APP_NAME = "VojaIwate";
export const APP_TITLE = "VOJA IWATE";
export const APP_TAGLINE = "Playful Iwate Travel Companion";
export const APP_DESCRIPTION =
  "VOJA IWATE は、岩手の旅先を地図、検索、カメラ体験で気軽に楽しめる観光アプリです。";
export const APP_OG_DESCRIPTION =
  "岩手の見どころを見つけて、歩いて、撮って楽しめる VOJA IWATE。";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
export const SECRET_WORKSPACE_PATH = "/studio";
export const SECRET_WORKSPACE_LOGIN_PATH = "/studio/access";
export const PUBLIC_LOGIN_PATH = "/login";
export const SPOTS_INDEX_PATH = "/spots";
export const CHARACTER_PATH = "/character";
export const LEGACY_GUIDE_PATH = "/guide";
export const MAP_PATH = "/map";
export const STAMPS_PATH = "/stamps";
export const FAVORITES_PATH = "/favorites";

// Map settings (Leaflet / OSM)
export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const IWATE_CENTER = { lat: 39.7036, lng: 141.1527 };
export const MORIOKA_STATION = { lat: 39.7017, lng: 141.1365 };

export const PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: MAP_PATH, label: "Map" },
  { href: "/search", label: "Search" },
  { href: CHARACTER_PATH, label: "Character" },
  { href: "/camera", label: "Camera" },
] as const;

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
