"use client";

import { useSyncExternalStore } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

/**
 * モバイル幅のビューポートか判定する。
 *
 * CSS の `md:hidden` だけでは非表示コンポーネント自体はマウントされたままなので、
 * スクロールロック系 UI が desktop で副作用だけ残すのを防ぐために使う。
 *
 * @returns モバイル幅なら true
 * @example
 * const isMobileViewport = useIsMobileViewport();
 */
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribeViewportChange, getViewportSnapshot, getServerViewportSnapshot);
}

/**
 * ビューポート変更を購読する。
 *
 * @param onStoreChange - 変更時コールバック
 * @returns 購読解除関数
 * @example
 * const unsubscribe = subscribeViewportChange(() => {});
 * unsubscribe();
 */
function subscribeViewportChange(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
  const handleChange = () => onStoreChange();
  mediaQueryList.addEventListener("change", handleChange);

  return () => {
    mediaQueryList.removeEventListener("change", handleChange);
  };
}

/**
 * クライアントの現在ビューポートを返す。
 *
 * @returns モバイル幅なら true
 * @example
 * getViewportSnapshot();
 */
function getViewportSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/**
 * サーバー描画時の既定ビューポートを返す。
 *
 * @returns サーバーでは desktop 扱い
 * @example
 * getServerViewportSnapshot();
 */
function getServerViewportSnapshot(): boolean {
  return false;
}
