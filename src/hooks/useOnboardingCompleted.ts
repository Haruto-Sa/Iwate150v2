"use client";

import { useSyncExternalStore } from "react";
import { ONBOARDING_COMPLETED_KEY } from "@/lib/config";

const ONBOARDING_STATUS_EVENT = "iwate150:onboarding-status";

/**
 * オンボーディング完了状態の変更を購読する。
 *
 * @param onStoreChange - 状態変更時に呼ぶコールバック
 * @returns 購読解除関数
 * @example
 * const unsubscribe = subscribeOnboardingStatus(() => {});
 * unsubscribe();
 */
function subscribeOnboardingStatus(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  /**
   * storage/custom event の変化を購読側へ通知する。
   *
   * @returns なし
   * @example
   * notifyStoreChange();
   */
  function notifyStoreChange(): void {
    onStoreChange();
  }

  window.addEventListener("storage", notifyStoreChange);
  window.addEventListener(ONBOARDING_STATUS_EVENT, notifyStoreChange);

  return () => {
    window.removeEventListener("storage", notifyStoreChange);
    window.removeEventListener(ONBOARDING_STATUS_EVENT, notifyStoreChange);
  };
}

/**
 * クライアントでオンボーディング完了状態を返す。
 *
 * @returns 完了済みなら true
 * @example
 * getOnboardingCompletedSnapshot();
 */
function getOnboardingCompletedSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
}

/**
 * サーバー描画用のオンボーディング状態を返す。
 *
 * @returns サーバーでは常に完了扱い
 * @example
 * getOnboardingCompletedServerSnapshot();
 */
function getOnboardingCompletedServerSnapshot(): boolean {
  return true;
}

/**
 * 初回メニューの既読を購読し、案内の重複表示を防ぐ。
 * @returns 完了済みならtrue
 * @example const completed = useOnboardingCompleted();
 */
export function useOnboardingCompleted(): boolean {
  return useSyncExternalStore(subscribeOnboardingStatus, getOnboardingCompletedSnapshot, getOnboardingCompletedServerSnapshot);
}

/**
 * 初回メニューの完了を保存し、同じ画面の購読者へ通知する。
 * @returns なし
 * @example completeOnboarding();
 */
export function completeOnboarding(): void {
  window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
  window.dispatchEvent(new Event(ONBOARDING_STATUS_EVENT));
}
