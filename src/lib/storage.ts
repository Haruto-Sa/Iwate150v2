import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage URL helper
 *
 * Assumes a single public bucket (default: "iwate150data") with folder prefixes:
 * - images/  (for spot/character images)
 * - models/  (for 3D models OBJ/MTL/GLB)
 *
 * If path is null/undefined or doesn't start with expected prefix,
 * returns the path as-is (for backward compatibility with local /public paths).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const BUCKET_NAME =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
  process.env.SUPABASE_STORAGE_BUCKET ??
  "iwate150data";
const STORAGE_PREFIXES = ["/images/", "/models/", "images/", "models/"] as const;
const ASCII_SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SIGNED_MODE = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_MODE === "signed";
const SIGNED_TTL_SECONDS = Number(process.env.NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN ?? "21600");
const SIGNED_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const serverSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();
let serverStorageClient: SupabaseClient | null | undefined;

/**
 * 既存の legacy/public 互換パスを Storage 相対パスへ正規化する。
 *
 * @param path - `"/images/..."` / `"images/..."` / `"/models/..."` / `"models/..."`
 * @returns Storage 相対パス。対象外の形式なら null
 * @example
 * normalizeStoragePath("/images/spots/foo.jpg"); // => "images/spots/foo.jpg"
 */
export function normalizeStoragePath(path: string): string | null {
  for (const prefix of STORAGE_PREFIXES) {
    if (path.startsWith(prefix)) {
      return path.startsWith("/") ? path.slice(1) : path;
    }
  }
  return null;
}

/**
 * Storage object key 用にパスセグメントを ASCII セーフ形式へ変換する。
 *
 * @param path - Storage 相対パス
 * @returns エンコード済みパス
 * @example
 * encodeStoragePath("models/ごしょどん3.fbx");
 */
export function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => toAsciiSafeStorageSegment(decodeURIComponentSafe(segment)))
    .join("/");
}

/**
 * Storage キー用セグメントを ASCII セーフ表現へ変換する。
 *
 * Supabase 側で非ASCIIキーが弾かれるケースに備え、UTF-8 bytes を hex 化した
 * `u<hex>` 形式へフォールバックする。
 *
 * @param segment - パスセグメント
 * @returns ASCII セーフなパスセグメント
 * @example
 * toAsciiSafeStorageSegment("かっこうだんご.jpg");
 */
export function toAsciiSafeStorageSegment(segment: string): string {
  if (ASCII_SAFE_SEGMENT.test(segment)) return segment;
  const bytes = new TextEncoder().encode(segment);
  const hex = Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `u${hex}`;
}

/**
 * decodeURIComponent の安全版。
 *
 * @param value - 任意文字列
 * @returns decode 結果。失敗時は入力値を返す
 * @example
 * decodeURIComponentSafe("%E3%81%82");
 */
export function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Build public URL for a Storage asset.
 * @param path - Path in storage (e.g., "images/spots/foo.jpg") or local path (e.g., "/images/foo.jpg")
 * @param type - Asset type hint: "image" | "model" | "generic"
 * @returns Full public URL or null if path is empty
 */
export function getPublicUrl(
  path: string | null | undefined,
  _type: "image" | "model" | "generic" = "generic"
): string | null {
  if (!path) return null;

  // If path already starts with http(s), return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // /images/* と /models/* は legacy DB 値でも Storage 解決できるようにする
  const normalizedStoragePath = normalizeStoragePath(path);
  if (normalizedStoragePath) {
    if (!SUPABASE_URL) {
      return `/${normalizedStoragePath}`;
    }
    const encodedPath = encodeStoragePath(normalizedStoragePath);
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`;
  }

  // If path starts with "/", keep local public asset path for backward compatibility
  if (path.startsWith("/")) return path;

  // Other relative paths are handled as Storage paths when SUPABASE_URL exists
  if (!SUPABASE_URL) return `/${path}`;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeStoragePath(path)}`;
}

/**
 * DB の path 値を Storage object key へ変換する。
 *
 * @param path - DB path
 * @returns Storage object key。対象外なら null
 * @example
 * toStorageObjectPath("images/spots/foo.jpg");
 */
export function toStorageObjectPath(path: string | null | undefined): string | null {
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const markerIndex = path.indexOf(marker);
    if (markerIndex === -1) return null;
    return encodeStoragePath(path.slice(markerIndex + marker.length));
  }

  const normalized = normalizeStoragePath(path);
  if (!normalized) return null;
  return encodeStoragePath(normalized);
}

/**
 * サーバーサイドで利用する Storage クライアントを返す。
 *
 * @returns Supabase client。ブラウザ実行時は null
 * @example
 * const client = getServerStorageClient();
 */
function getServerStorageClient(): SupabaseClient | null {
  if (typeof window !== "undefined") return null;
  if (serverStorageClient !== undefined) return serverStorageClient;

  if (!SUPABASE_URL) {
    serverStorageClient = null;
    return serverStorageClient;
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessKey = serviceRoleKey ?? anonKey;
  if (!accessKey) {
    serverStorageClient = null;
    return serverStorageClient;
  }

  serverStorageClient = createClient(SUPABASE_URL, accessKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverStorageClient;
}

/**
 * サーバーサイドで asset URL を解決する。
 *
 * `NEXT_PUBLIC_SUPABASE_STORAGE_MODE=signed` の場合、signed URL を生成しメモリキャッシュする。
 *
 * @param path - DB path
 * @param type - asset type
 * @returns 利用可能な URL
 * @example
 * const url = await resolveServerStorageUrl("images/spots/foo.jpg", "image");
 */
export async function resolveServerStorageUrl(
  path: string | null | undefined,
  type: "image" | "model" | "generic" = "generic"
): Promise<string | null> {
  const publicUrl = getPublicUrl(path, type);
  if (!path || !SIGNED_MODE) return publicUrl;

  const objectPath = toStorageObjectPath(path);
  if (!objectPath) return publicUrl;

  const cacheKey = `${type}:${objectPath}`;
  const cached = serverSignedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > SIGNED_REFRESH_MARGIN_MS) {
    return cached.url;
  }

  const client = getServerStorageClient();
  if (!client) return publicUrl;

  const expiresIn = Number.isFinite(SIGNED_TTL_SECONDS)
    ? Math.min(86400, Math.max(3600, Math.floor(SIGNED_TTL_SECONDS)))
    : 21600;

  const { data, error } = await client.storage.from(BUCKET_NAME).createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) return publicUrl;

  const entry = {
    url: data.signedUrl,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  serverSignedUrlCache.set(cacheKey, entry);
  return entry.url;
}

/**
 * サーバーサイドで複数 path の URL を一括解決する。
 *
 * @param paths - path 配列
 * @param type - asset type
 * @returns `path -> url` の Map
 * @example
 * const map = await resolveServerStorageUrls(paths, "image");
 */
export async function resolveServerStorageUrls(
  paths: Array<string | null | undefined>,
  type: "image" | "model" | "generic" = "generic"
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const entries = await Promise.all(
    uniquePaths.map(async (path) => {
      const url = await resolveServerStorageUrl(path, type);
      return [path, url] as const;
    })
  );
  return new Map(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));
}

/**
 * Convenience wrapper for image URLs
 */
export function getImageUrl(path: string | null | undefined): string | null {
  return getPublicUrl(path, "image");
}

/**
 * Convenience wrapper for 3D model URLs
 */
export function getModelUrl(path: string | null | undefined): string | null {
  return getPublicUrl(path, "model");
}

/**
 * Convert a local path to storage path format
 * e.g., "/images/spots/foo.jpg" -> "images/spots/foo.jpg"
 */
export function toStoragePath(localPath: string): string {
  return localPath.startsWith("/") ? localPath.slice(1) : localPath;
}

/**
 * Check if URL is from Supabase Storage
 */
export function isStorageUrl(url: string | null | undefined): boolean {
  if (!url || !SUPABASE_URL) return false;
  return url.startsWith(SUPABASE_URL);
}
