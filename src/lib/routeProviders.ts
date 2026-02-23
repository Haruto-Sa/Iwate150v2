/**
 * ルート検索プロバイダ定義
 *
 * 無料 (OSRM Public) と有料 (OpenRouteService) の2つのルートエンジンを切り替え、
 * 外部地図アプリへの遷移URLを生成するユーティリティ。
 */

import { ROUTE_CONFIG } from "@/lib/config";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** ルートモード: 無料 or 有料 */
export type RouteMode = "free" | "paid";

/** ルートプロバイダ識別子 */
export type RouteProvider = "osrm" | "openrouteservice";

/** 位置座標 */
export type LatLng = { lat: number; lng: number };

/** ルートURL生成結果 */
export type RouteUrlResult =
  | { ok: true; url: string; provider: RouteProvider; fellBack: false }
  | { ok: true; url: string; provider: RouteProvider; fellBack: true; reason: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/**
 * 有料プロバイダ (OpenRouteService) が利用可能かを判定する
 *
 * @returns 環境変数が設定されていれば true
 * @example
 * if (isPaidProviderAvailable()) { ... }
 */
export function isPaidProviderAvailable(): boolean {
  return Boolean(ROUTE_CONFIG.openRouteServiceApiKey);
}

/**
 * 指定モードに対応するプロバイダを返す。
 * 有料が選択されているが設定不備の場合は無料にフォールバックする。
 *
 * @param mode - ユーザーが選択したルートモード
 * @returns 実際に使用するプロバイダとフォールバック理由
 * @example
 * const { provider, fellBack } = resolveProvider("paid");
 */
export function resolveProvider(mode: RouteMode): {
  provider: RouteProvider;
  fellBack: boolean;
  reason: string;
} {
  if (mode === "paid") {
    if (isPaidProviderAvailable()) {
      return { provider: "openrouteservice", fellBack: false, reason: "" };
    }
    return {
      provider: "osrm",
      fellBack: true,
      reason: "別の地図で案内を表示しました。",
    };
  }
  return { provider: "osrm", fellBack: false, reason: "" };
}

// ---------------------------------------------------------------------------
// URL 生成
// ---------------------------------------------------------------------------

/**
 * OSRM(無料) の外部表示 URL を生成する。
 *
 * API エンドポイントではなく OpenStreetMap の directions 画面を開く。
 * これにより JSON レスポンスがそのまま表示される問題を回避する。
 *
 * @param origin - 出発地の緯度経度
 * @param destination - 目的地の緯度経度
 * @returns OpenStreetMap directions URL
 * @example
 * const url = buildOsrmUrl({ lat: 39.7, lng: 141.1 }, { lat: 39.8, lng: 141.2 });
 * // => "https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=39.7%2C141.1%3B39.8%2C141.2"
 */
export function buildOsrmUrl(origin: LatLng, destination: LatLng): string {
  const route = encodeURIComponent(
    `${origin.lat},${origin.lng};${destination.lat},${destination.lng}`
  );
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${route}`;
}

/**
 * OpenRouteService の外部マップ URL を生成する
 *
 * @param origin - 出発地の緯度経度
 * @param destination - 目的地の緯度経度
 * @returns OpenRouteService Maps の URL
 * @example
 * const url = buildOpenRouteServiceUrl({ lat: 39.7, lng: 141.1 }, { lat: 39.8, lng: 141.2 });
 */
export function buildOpenRouteServiceUrl(origin: LatLng, destination: LatLng): string {
  const coordinates = encodeURIComponent(
    `${origin.lng},${origin.lat},${destination.lng},${destination.lat}`
  );
  const centerLat = ((origin.lat + destination.lat) / 2).toFixed(6);
  const centerLng = ((origin.lng + destination.lng) / 2).toFixed(6);
  return `https://maps.openrouteservice.org/directions?a=${coordinates}&b=0&c=0&k1=ja-JP&k2=km&n1=${centerLat}&n2=${centerLng}&n3=11`;
}

/**
 * Google Maps のルート URL を生成する（フォールバック / 共通利用用）
 *
 * @param destination - 目的地の緯度経度
 * @returns Google Maps ルート URL
 * @example
 * const url = buildGoogleMapsUrl({ lat: 39.8, lng: 141.2 });
 */
export function buildGoogleMapsUrl(destination: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
}

// ---------------------------------------------------------------------------
// メインエントリ
// ---------------------------------------------------------------------------

/**
 * 指定モードに基づいて外部ルートURLを生成する
 *
 * 有料プロバイダが選択されていても設定不備の場合は自動的に無料にフォールバックし、
 * その旨を結果に含めて返す。
 *
 * @param mode - ユーザーが選択したルートモード ("free" | "paid")
 * @param origin - 出発地（通常は現在地）
 * @param destination - 目的地のスポット座標
 * @returns ルート URL 生成結果
 * @example
 * const result = buildRouteUrl("free", userPos, { lat: 39.8, lng: 141.2 });
 * if (result.ok) window.open(result.url, "_blank");
 */
export function buildRouteUrl(
  mode: RouteMode,
  origin: LatLng | null,
  destination: LatLng
): RouteUrlResult {
  // 現在地が取得できていない場合は Google Maps に委ねる（現在地は端末側で補完）
  if (!origin) {
    return {
      ok: true,
      url: buildGoogleMapsUrl(destination),
      provider: "osrm",
      fellBack: true,
      reason: "現在地を確認できないため、目的地の地図を表示しました。",
    };
  }

  const { provider, fellBack, reason } = resolveProvider(mode);

  const url =
    provider === "osrm"
      ? buildOsrmUrl(origin, destination)
      : buildOpenRouteServiceUrl(origin, destination);

  if (fellBack) {
    return { ok: true, url, provider, fellBack: true, reason };
  }
  return { ok: true, url, provider, fellBack: false };
}
