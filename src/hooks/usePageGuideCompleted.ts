"use client";

import { useSyncExternalStore } from "react";
import { completeOnboarding } from "./useOnboardingCompleted";
import type { GuidePath } from "@/lib/pageGuides";

const EVENT = "voja-page-guide-change";
const completedInMemory = new Set<GuidePath>();

/** ページ別の既読キー。@param path - 対象画面 @returns 保存キー @example pageGuideKey("/camera"); */
export function pageGuideKey(path: GuidePath): string { return `voja_page_guide:${path}`; }

/** 既読変更を購読する。@param listener - 再取得処理 @returns 解除処理 @example subscribe(refresh); */
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", listener); };
}

/** 保存状態を読む。旧全体案内の既読はホームだけに引き継ぐ。@param path - 画面 @returns 既読状態 @example readCompleted("/"); */
function readCompleted(path: GuidePath | null): boolean {
  if (!path) return true;
  if (completedInMemory.has(path)) return true;
  try { return localStorage.getItem(pageGuideKey(path)) === "true" || (path === "/" && localStorage.getItem("onboarding_completed") === "true"); }
  catch { return false; }
}

/** SSRでは初回案内を開かない。@returns true @example serverCompleted(); */
function serverCompleted(): boolean { return true; }

/** ページ単位の既読を購読する。@param path - 対象画面 @returns 既読状態 @example usePageGuideCompleted("/map"); */
export function usePageGuideCompleted(path: GuidePath | null): boolean {
  return useSyncExternalStore(subscribe, () => readCompleted(path), serverCompleted);
}

/** 案内の終了を保存する。@param path - 対象画面 @returns なし @example completePageGuide("/map"); */
export function completePageGuide(path: GuidePath): void {
  try {
    localStorage.setItem(pageGuideKey(path), "true");
    if (path === "/") completeOnboarding();
  } catch { completedInMemory.add(path); }
  window.dispatchEvent(new Event(EVENT));
}
