export type ModelFormat = "obj" | "fbx";

/**
 * URL/パスから拡張子なしファイル名（小文字）を取り出す。
 *
 * @param url - URL またはパス
 * @returns ファイル名（拡張子なし）
 * @example
 * const stem = extractFileStem("/models/wanko1.obj?token=abc");
 */
export function extractFileStem(url: string): string | null {
  const stripped = url.split("?")[0]?.split("#")[0] ?? url;
  const segment = stripped.split("/").pop();
  if (!segment) return null;
  const decoded = decodeURIComponent(segment);
  const dotIndex = decoded.lastIndexOf(".");
  const stem = dotIndex > 0 ? decoded.slice(0, dotIndex) : decoded;
  return stem.toLowerCase();
}

/**
 * URL 文字列からモデル形式を推定する。
 *
 * @param modelUrl - モデルURL
 * @returns `obj` または `fbx`
 * @example
 * const format = resolveModelFormat("/models/character.fbx");
 */
export function resolveModelFormat(modelUrl: string): ModelFormat {
  const stripped = modelUrl.split("?")[0]?.split("#")[0] ?? modelUrl;
  return stripped.toLowerCase().endsWith(".fbx") ? "fbx" : "obj";
}

/**
 * Storage相対パスからローカルpublic参照URLを作成する。
 *
 * @param path - `models/...` 形式のパス
 * @returns `/models/...` 形式のURL
 * @example
 * const local = toLocalAssetUrl("models/goshodon.obj");
 */
export function toLocalAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * 候補URL配列を重複なく組み立てる。
 *
 * @param values - URL候補
 * @returns 重複除去済みURL配列
 * @example
 * const urls = buildUniqueCandidates([localUrl]);
 */
export function buildUniqueCandidates(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
