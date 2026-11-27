import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicUrl, toStorageObjectPath, getStorageBucket, getSignedTtlSeconds } from "./storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const BUCKET_NAME = getStorageBucket();
const SIGNED_MODE = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_MODE === "signed";
const SIGNED_TTL_SECONDS = getSignedTtlSeconds();
const SIGNED_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const serverSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();
let serverStorageClient: SupabaseClient | null | undefined;

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

  const expiresIn = SIGNED_TTL_SECONDS;

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

