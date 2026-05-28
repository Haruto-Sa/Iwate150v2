"use client";

import { useEffect } from "react";

const CACHE_PREFIXES = ["serwist", "voja-"] as const;

/**
 * 開発中だけ既存 Service Worker と関連キャッシュを解除する。
 *
 * PWA を導入した直後の `localhost` では、以前に登録された Service Worker が
 * HMR やアセット解決へ干渉して再描画ループの原因になることがあるため、
 * development 環境では明示的に解除する。
 *
 * @returns なし
 * @example
 * <DevelopmentServiceWorkerReset />
 */
export function DevelopmentServiceWorkerReset() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    /**
     * 開発用 Service Worker と関連キャッシュをクリーンアップする。
     *
     * @returns なし
     * @example
     * await cleanupDevelopmentServiceWorkers();
     */
    async function cleanupDevelopmentServiceWorkers(): Promise<void> {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) => registration.scope.startsWith(window.location.origin))
            .map((registration) => registration.unregister())
        );
      } catch (error) {
        console.warn("[pwa] failed to unregister development service workers", error);
      }

      try {
        const cacheKeys = await window.caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
            .map((key) => window.caches.delete(key))
        );
      } catch (error) {
        console.warn("[pwa] failed to clear development caches", error);
      }
    }

    void cleanupDevelopmentServiceWorkers();
  }, []);

  return null;
}
