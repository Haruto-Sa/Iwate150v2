"use client";

import { useSyncExternalStore } from "react";

export type ColorTheme = "light" | "dark" | "system";
const CHANGE_EVENT = "voja-theme-change";

/**
 * 適用済みの外観設定を取得する。
 * @returns ライト・ダーク・端末設定
 * @example readColorTheme();
 */
function readColorTheme(): ColorTheme {
  const value = document.documentElement.dataset.themePreference;
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * 同一タブ・他タブ・端末設定の変更を購読する。
 * @param listener - 更新処理
 * @returns 購読解除処理
 * @example subscribeColorTheme(refresh);
 */
function subscribeColorTheme(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

/**
 * SSR中の選択欄は端末設定を既定とする。
 * @returns system
 * @example serverColorTheme();
 */
function serverColorTheme(): ColorTheme { return "system"; }

/**
 * 外観を変更し、初期描画と同じ処理で保存・適用する。
 * @param theme - 外観設定
 * @returns なし
 * @example setColorTheme("dark");
 */
export function setColorTheme(theme: ColorTheme): void {
  window.dispatchEvent(new CustomEvent("voja-theme-set", { detail: theme }));
}

/**
 * 現在の外観設定を返す。
 * @returns ライト・ダーク・端末設定
 * @example const theme = useColorTheme();
 */
export function useColorTheme(): ColorTheme {
  return useSyncExternalStore(subscribeColorTheme, readColorTheme, serverColorTheme);
}
