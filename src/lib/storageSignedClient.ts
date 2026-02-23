"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getPublicUrl, toStorageObjectPath } from "@/lib/storage";

type AssetType = "image" | "model" | "generic";
type StorageMode = "public" | "signed";
type SignedCacheEntry = { url: string; expiresAt: number };

const CACHE_KEY = "iwate150_signed_url_cache_v1";
const CACHE_REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** createSignedUrl API 呼び出しのタイムアウト（ミリ秒） */
const SIGNED_URL_REQUEST_TIMEOUT_MS = 20_000;
const memoryCache = new Map<string, SignedCacheEntry>();

/**
 * Storage 配信モードを取得する。
 *
 * @returns `public` または `signed`
 * @example
 * const mode = getStorageMode();
 */
function getStorageMode(): StorageMode {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_MODE;
  return raw === "signed" ? "signed" : "public";
}

/**
 * signed URL の有効期限（秒）を取得する。
 *
 * @returns 3600〜86400 秒
 * @example
 * const expiresIn = getSignedTtlSeconds();
 */
function getSignedTtlSeconds(): number {
  const raw = Number(process.env.NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN ?? "21600");
  if (!Number.isFinite(raw)) return 21600;
  return Math.min(86400, Math.max(3600, Math.floor(raw)));
}

/**
 * キャッシュキーを生成する。
 *
 * @param objectPath - Storage object key
 * @param type - asset type
 * @returns キャッシュキー
 * @example
 * buildCacheKey("images/spots/a.jpg", "image");
 */
function buildCacheKey(objectPath: string, type: AssetType): string {
  return `${type}:${objectPath}`;
}

/**
 * キャッシュ有効期限内か判定する。
 *
 * @param entry - キャッシュエントリ
 * @returns 有効なら true
 * @example
 * isValidCacheEntry(entry);
 */
function isValidCacheEntry(entry: SignedCacheEntry | undefined): entry is SignedCacheEntry {
  if (!entry) return false;
  return entry.expiresAt - Date.now() > CACHE_REFRESH_MARGIN_MS;
}

/**
 * localStorage から signed URL キャッシュを復元する。
 *
 * @returns なし
 * @example
 * restoreCacheFromLocalStorage();
 */
function restoreCacheFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  if (memoryCache.size > 0) return;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, SignedCacheEntry>;
    for (const [key, entry] of Object.entries(parsed)) {
      if (isValidCacheEntry(entry)) {
        memoryCache.set(key, entry);
      }
    }
  } catch {
    // ignore cache restore errors
  }
}

/**
 * signed URL キャッシュを localStorage へ保存する。
 *
 * @returns なし
 * @example
 * persistCacheToLocalStorage();
 */
function persistCacheToLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Record<string, SignedCacheEntry> = {};
    for (const [key, entry] of memoryCache.entries()) {
      if (isValidCacheEntry(entry)) payload[key] = entry;
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache persist errors
  }
}

/**
 * クライアントで Storage URL を解決する。
 *
 * `NEXT_PUBLIC_SUPABASE_STORAGE_MODE=signed` の場合は signed URL をキャッシュして再利用する。
 * それ以外は公開URLを返す。
 *
 * @param path - DB path
 * @param type - asset type
 * @returns 利用可能な URL
 * @example
 * const url = await resolveClientStorageUrl("images/spots/a.jpg", "image");
 */
export async function resolveClientStorageUrl(
  path: string | null | undefined,
  type: AssetType = "generic"
): Promise<string | null> {
  if (!path) return null;
  const publicUrl = getPublicUrl(path, type);
  if (getStorageMode() !== "signed") {
    return publicUrl;
  }

  const objectPath = toStorageObjectPath(path);
  if (!objectPath) return publicUrl;

  restoreCacheFromLocalStorage();
  const cacheKey = buildCacheKey(objectPath, type);
  const cached = memoryCache.get(cacheKey);
  if (isValidCacheEntry(cached)) {
    return cached.url;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return publicUrl;

  const expiresIn = getSignedTtlSeconds();

  // createSignedUrl がハングする場合に備えてタイムアウトを設定
  try {
    const result = await Promise.race([
      supabase.storage.from(
        process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
          process.env.SUPABASE_STORAGE_BUCKET ??
          "iwate150data"
      ).createSignedUrl(objectPath, expiresIn),
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => {
          console.warn(`[storageSignedClient] createSignedUrl timeout: ${objectPath}`);
          resolve({ data: null, error: new Error("signed url timeout") });
        }, SIGNED_URL_REQUEST_TIMEOUT_MS),
      ),
    ]);

    const { data, error } = result;
    if (error || !data?.signedUrl) {
      return publicUrl;
    }

    const entry: SignedCacheEntry = {
      url: data.signedUrl,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    memoryCache.set(cacheKey, entry);
    persistCacheToLocalStorage();
    return entry.url;
  } catch (err) {
    console.warn(`[storageSignedClient] createSignedUrl error: ${objectPath}`, err);
    return publicUrl;
  }
}

/**
 * 複数 path の Storage URL を一括解決する。
 *
 * @param paths - path 配列
 * @param type - asset type
 * @returns `path -> url` の Map
 * @example
 * const map = await resolveClientStorageUrls(["images/a.jpg"], "image");
 */
export async function resolveClientStorageUrls(
  paths: Array<string | null | undefined>,
  type: AssetType = "generic"
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const entries = await Promise.all(
    uniquePaths.map(async (path) => {
      const url = await resolveClientStorageUrl(path, type);
      return [path, url] as const;
    })
  );
  return new Map(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));
}

/**
 * 単一 path の Storage URL を React で取得するフック。
 *
 * @param path - DB path
 * @param type - asset type
 * @returns 解決済みURL
 * @example
 * const url = useResolvedStorageUrl(path, "image");
 */
export function useResolvedStorageUrl(
  path: string | null | undefined,
  type: AssetType = "generic"
): string | null {
  const fallback = useMemo(() => getPublicUrl(path, type), [path, type]);
  const [url, setUrl] = useState<string | null>(fallback);

  useEffect(() => {
    let cancelled = false;
    setUrl(fallback);
    resolveClientStorageUrl(path, type).then((nextUrl) => {
      if (!cancelled) setUrl(nextUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [fallback, path, type]);

  return url;
}

/**
 * 複数 path の Storage URL を React で取得するフック。
 *
 * @param paths - path 配列
 * @param type - asset type
 * @returns `path -> url` Map
 * @example
 * const map = useResolvedStorageUrls(paths, "image");
 */
export function useResolvedStorageUrls(
  paths: Array<string | null | undefined>,
  type: AssetType = "generic"
): Map<string, string> {
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());
  const key = useMemo(
    () =>
      paths
        .filter((path): path is string => Boolean(path))
        .sort()
        .join("|"),
    [paths]
  );

  useEffect(() => {
    let cancelled = false;
    resolveClientStorageUrls(paths, type).then((nextMap) => {
      if (!cancelled) setUrlMap(nextMap);
    });
    return () => {
      cancelled = true;
    };
  }, [key, paths, type]);

  return urlMap;
}
