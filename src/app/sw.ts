/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Supabase / API / Next data request を判定する。
 *
 * @param url - 判定対象 URL
 * @returns NetworkFirst にしたい request なら true
 * @example
 * isNetworkFirstApiRequest(new URL("https://example.supabase.co/rest/v1/spots"));
 */
function isNetworkFirstApiRequest(url: URL): boolean {
  return (
    url.hostname.endsWith(".supabase.co") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/")
  );
}

/**
 * Leaflet タイル request を判定する。
 *
 * @param url - 判定対象 URL
 * @returns タイル request なら true
 * @example
 * isLeafletTileRequest(new URL("https://tile.openstreetmap.org/1/2/3.png"));
 */
function isLeafletTileRequest(url: URL): boolean {
  return (
    url.hostname.includes("openstreetmap.org") ||
    url.hostname.includes("cartocdn.com")
  );
}

/**
 * 同一originの認証API・管理画面をキャッシュ対象から除外する。
 * Cookie認証はAuthorizationヘッダーの有無では判断できないため、URLで境界を定める。
 * @param url - リクエストURL（queryは判定に影響しない）
 * @returns 保存・再利用してはいけないURLならtrue
 * @example isPrivateUrl(new URL("/studio/users?_rsc=example", self.location.origin));
 */
function isPrivateUrl(url: URL): boolean {
  return url.origin === self.location.origin && (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/studio" ||
    url.pathname.startsWith("/studio/")
  );
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher({ request, url }) {
        return request.headers.has("authorization") ||
          isPrivateUrl(url);
      },
      handler: new NetworkOnly(),
    },
    {
      matcher({ request, url }) {
        return request.destination === "image" && isLeafletTileRequest(url);
      },
      handler: new CacheFirst({
        cacheName: "voja-leaflet-tiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher({ request, url }) {
        return request.destination === "image" && !isLeafletTileRequest(url);
      },
      handler: new CacheFirst({
        cacheName: "voja-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher({ request, url }) {
        return request.method === "GET" && isNetworkFirstApiRequest(url);
      },
      handler: new NetworkFirst({
        cacheName: "voja-network-data",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 80,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// 旧版が保存した認証API・管理画面のHTML/RSC応答を更新時に除去する。
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // 旧版が個人REST応答を含めていたキャッシュは丸ごと破棄する。
    await caches.delete("voja-network-data");
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        if (isPrivateUrl(url)) {
          await cache.delete(request);
        }
      }
    }
  })());
});

serwist.addEventListeners();
