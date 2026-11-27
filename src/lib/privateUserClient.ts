import type { Favorite, Stamp, StampCatalog } from "./types";
import { mockStampCatalog } from "./mockData";

// ─────────────────────────────────────────────────────────────
// 本人データはサーバーセッションを検証するAPI経由でのみ操作する。

/**
 * 本人APIへリクエストする。失敗を空一覧や保存成功に変換しない。
 *
 * @param path - API名
 * @param identity - 開始時のセッションID（所有者指定には使わない）
 *
 * @param method - HTTP method
 * @param body - 本文
 *
 * @returns API結果
 *
 * @example await requestPrivateData("favorites", identity);
 */
async function requestPrivateData<T>(path: string, identity: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/me/${path}`, {
    method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", "X-Session-User": identity },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("保存サービスに接続できません。再読み込みしてお試しください。");
  return response.json() as Promise<T>;
}

/**
 * 本人の一覧を上限付きで全ページ取得する。
 *
 * @param table - 一覧名
 * @param identity - 開始時セッション
 *
 * @returns 本人の保存済みレコード
 *
 * @example await fetchPrivateRecords<Favorite>("favorites", identity);
 */
async function fetchPrivateRecords<T>(table: string, identity: string): Promise<T[]> {
  const items: T[] = [];
  let offset: number | null = 0;
  for (let page = 0; page < 100 && offset !== null; page++) {
    const result: { items: T[]; nextOffset: number | null } = await requestPrivateData(`${table}?offset=${offset}`, identity);
    items.push(...result.items);
    offset = result.nextOffset;
  }
  if (offset !== null) throw new Error("保存件数が多すぎます。サポートへお問い合わせください。");
  return items;
}

/**
 * 本人のスタンプを取得する。
 *
 * @param identity - 開始時セッションID
 * @returns 保存済みスタンプ
 *
 * @example await fetchUserStamps(user.id);
 */
export async function fetchUserStamps(identity: string): Promise<Stamp[]> {
  return fetchPrivateRecords("stamps", identity);
}

/**
 * 本人のスタンプを冪等に保存する。
 *
 * @param identity - 開始時セッションID
 * @param spotId - スポットID
 *
 * @returns 保存確認済みスタンプ
 *
 * @example await createStamp(user.id, 10);
 */
export async function createStamp(identity: string, spotId: number): Promise<Stamp | null> {
  const result = await requestPrivateData<{ items: Stamp[] }>("stamps", identity, "POST", { spotId });
  return result.items.find((item) => item.spot_id === spotId) ?? null;
}

/**
 * 本人のお気に入りを取得する。
 *
 * @param identity - 開始時セッションID
 * @returns 保存済みお気に入り
 *
 * @example await fetchUserFavorites(user.id);
 */
export async function fetchUserFavorites(identity: string): Promise<Favorite[]> {
  return fetchPrivateRecords("favorites", identity);
}

/**
 * 本人のお気に入りを冪等に追加する。
 *
 * @param identity - 開始時セッションID
 * @param spotId - スポットID
 *
 * @returns 保存確認済みお気に入り
 *
 * @example await addFavorite(user.id, 10);
 */
export async function addFavorite(identity: string, spotId: number): Promise<Favorite | null> {
  const result = await requestPrivateData<{ items: Favorite[] }>("favorites", identity, "PUT", { spotId });
  return result.items.find((item) => item.spot_id === spotId) ?? null;
}

/**
 * 本人のお気に入りだけを削除する。
 *
 * @param identity - 開始時セッションID
 * @param spotId - スポットID
 *
 * @returns 成功時true、通信失敗時は例外
 *
 * @example await removeFavorite(user.id, 10);
 */
export async function removeFavorite(identity: string, spotId: number): Promise<boolean> {
  await requestPrivateData("favorites", identity, "DELETE", { spotId });
  return true;
}

/**
 * 一回の同期で保存を確認したIDを返す。
 *
 * @param identity - 開始時セッションID
 * @param spotIds - 最大100件のスポットID
 *
 * @returns 保存確認済みID
 *
 * @example await mergeFavorites(user.id, [1, 2]);
 */
export async function mergeFavorites(identity: string, spotIds: number[]): Promise<number[]> {
  if (!spotIds.length) return [];
  const result = await requestPrivateData<{ persistedSpotIds: number[] }>("favorites", identity, "POST", { spotIds });
  return result.persistedSpotIds;
}


/**
 * 出所情報を保った公開スタンプカタログを同一オリジンから取得する。
 * @returns 公開対象。通信失敗時は閲覧専用サンプル
 * @example const catalog = await fetchStampCatalog();
 */
export async function fetchStampCatalog(): Promise<StampCatalog> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/stamps/catalog", { cache: "no-store", signal: controller.signal });
    if (!response.ok) return mockStampCatalog;
    const catalog = await response.json() as StampCatalog;
    if (!Array.isArray(catalog.spots) || !Array.isArray(catalog.cities) || typeof catalog.isSample !== "boolean") return mockStampCatalog;
    return catalog;
  } catch {
    return mockStampCatalog;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
