"use client";

import { useEffect } from "react";

/**
 * Reactが初期HTMLを再構築した場合も、保存した外観を現在のルートへ適用する。
 * 初期描画はhead内のスクリプトが担当する。
 * @returns 表示要素なし
 * @example <ColorThemeSync />
 */
export function ColorThemeSync() {
  useEffect(() => { window.dispatchEvent(new Event("voja-theme-refresh")); }, []);
  return null;
}
