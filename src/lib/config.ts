export const APP_NAME = "VojaIwate";
export const APP_TITLE = "VOJA IWATE";
export const APP_TAGLINE = "いわての旅帖";
export const APP_DESCRIPTION =
  "VOJA IWATE は、岩手の旅先を地図、検索、カメラ体験で気軽に楽しめる観光アプリです。";
export const APP_OG_DESCRIPTION =
  "岩手の見どころを見つけて、歩いて、撮って楽しめる VOJA IWATE。";
export const APP_THEME_COLOR = "#0f3a3a";
export const APP_BACKGROUND_COLOR = "#ffffff";
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
export const OFFLINE_PATH = "/offline";

// Map settings (Leaflet / OSM)
export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const IWATE_CENTER = { lat: 39.7036, lng: 141.1527 };
export const MORIOKA_STATION = { lat: 39.7017, lng: 141.1365 };
export const IWATE_PUBLIC_BOUNDS = {
  minLat: 38.0,
  maxLat: 41.5,
  minLng: 140.0,
  maxLng: 142.5,
} as const;

export const PUBLIC_NAV_ITEMS = [
  { href: "/", label: "ホーム", messageKey: "home" },
  { href: "/camera", label: "カメラ", messageKey: "camera" },
  { href: "/search", label: "検索", messageKey: "search" },
  { href: MAP_PATH, label: "地図", messageKey: "map" },
  { href: STAMPS_PATH, label: "スタンプ", messageKey: "stamps" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { href: "/", label: "ホーム", messageKey: "home", icon: "home" },
  { href: "/camera", label: "カメラ", messageKey: "camera", icon: "camera" },
  { href: "/search", label: "検索", messageKey: "search", icon: "search" },
  { href: MAP_PATH, label: "地図", messageKey: "map", icon: "spot" },
  { href: STAMPS_PATH, label: "スタンプ", messageKey: "stamps", icon: "stamp" },
] as const;

export const MORE_MENU_ITEMS = [
  { href: CHARACTER_PATH, label: "キャラクター", messageKey: "characters", description: "3D キャラクターを見る", icon: "character" },
  { href: FAVORITES_PATH, label: "お気に入り", messageKey: "favorites", description: "気になるスポットを保存", icon: "favorite" },
] as const;

export const INSTALL_PROMPT_VISIT_KEY = "voja_install_prompt_visits";
export const INSTALL_PROMPT_DISMISS_UNTIL_KEY = "voja_install_prompt_dismiss_until";
export const ONBOARDING_COMPLETED_KEY = "onboarding_completed";
export const GUEST_FAVORITES_KEY = "voja_guest_favorites";
