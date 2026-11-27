/** 検索と管理一覧で共通のページング結果。 */
export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

/**
 * ページ番号を安全な範囲に正規化する。
 *
 * @param value - 入力ページ番号
 * @returns 1以上のページ番号
 * @example
 * const page = normalizePage(0);
 */
export function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value as number));
}

/**
 * ページサイズを安全な範囲に正規化する。
 *
 * @param value - 入力ページサイズ
 * @param defaultSize - 未定義・非有限値の場合の既定値
 * @param maxSize - 最大件数
 * @returns 1〜maxSize のページサイズ
 * @example
 * const pageSize = normalizePageSize(50, 50, 100);
 */
export function normalizePageSize(value: number | undefined, defaultSize: number, maxSize: number): number {
  if (!Number.isFinite(value)) return defaultSize;
  const safe = Math.floor(value as number);
  return Math.min(maxSize, Math.max(1, safe));
}

/**
 * ページング結果を構築する。
 *
 * @param items - 現在ページのアイテム
 * @param total - 総件数
 * @param page - 現在ページ
 * @param pageSize - ページサイズ
 * @returns ページング結果
 * @example
 * const result = buildPagedResult([], 0, 1, 50);
 */
export function buildPagedResult<T>(items: T[], total: number, page: number, pageSize: number): PagedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  };
}

