/**
 * URL 検索パラメータ値を単一文字列へ正規化する。
 *
 * @param value - 生の search param 値
 * @returns 単一文字列または null
 * @example
 * readSearchParamValue(["2"]);
 */
export function readSearchParamValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/**
 * page クエリを 1 以上の整数へ正規化する。
 *
 * @param value - 生の search param 値
 * @returns 正規化済み page
 * @example
 * parseStudioPageParam("3");
 */
export function parseStudioPageParam(value: string | null): number {
  if (!value) return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

/**
 * edit クエリを正の整数 ID へ正規化する。
 *
 * @param value - 生の search param 値
 * @returns 正規化済み ID または null
 * @example
 * parseStudioEditParam("12");
 */
export function parseStudioEditParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

