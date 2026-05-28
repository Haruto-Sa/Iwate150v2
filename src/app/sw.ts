/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
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

serwist.addEventListeners();
