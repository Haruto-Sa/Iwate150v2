"use client";

import { useEffect, useMemo, useState } from "react";
import {
  INSTALL_PROMPT_DISMISS_UNTIL_KEY,
  INSTALL_PROMPT_VISIT_KEY,
} from "@/lib/config";

type PromptOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPromptState = {
  isStandalone: boolean;
  isIosSafari: boolean;
  shouldShow: boolean;
  visitCount: number;
  promptInstall: () => Promise<PromptOutcome>;
  dismissForDays: (days: number) => void;
};

/**
 * PWA インストール促進の状態を管理する。
 *
 * @returns インストール促進 UI 用の状態と操作
 * @example
 * const installPrompt = useInstallPrompt();
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const nextVisitCount = Number(window.localStorage.getItem(INSTALL_PROMPT_VISIT_KEY) ?? "0") + 1;
    window.localStorage.setItem(INSTALL_PROMPT_VISIT_KEY, String(nextVisitCount));
    const nextDismissedUntil = Number(
      window.localStorage.getItem(INSTALL_PROMPT_DISMISS_UNTIL_KEY) ?? "0"
    );
    const frameId = window.requestAnimationFrame(() => {
      setIsStandalone(currentStandalone);
      setVisitCount(nextVisitCount);
      setIsDismissed(nextDismissedUntil > Date.now());
    });

    /**
     * beforeinstallprompt を保持する。
     *
     * @param event - ブラウザイベント
     * @returns なし
     * @example
     * handleBeforeInstallPrompt(event);
     */
    function handleBeforeInstallPrompt(event: Event): void {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    /**
     * アプリインストール完了を反映する。
     *
     * @returns なし
     * @example
     * handleAppInstalled();
     */
    function handleAppInstalled(): void {
      setIsStandalone(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isIosSafari = useMemo(() => {
    if (typeof window === "undefined") return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = userAgent.includes("safari") && !userAgent.includes("crios");
    return isIos && isSafari;
  }, []);

  /**
   * インストール促進を一定日数だけ抑止する。
   *
   * @param days - 抑止日数
   * @returns なし
   * @example
   * dismissForDays(7);
   */
  function dismissForDays(days: number): void {
    if (typeof window === "undefined") return;
    const nextDismissedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(INSTALL_PROMPT_DISMISS_UNTIL_KEY, String(nextDismissedUntil));
    setIsDismissed(true);
  }

  /**
   * ブラウザのインストール UI を起動する。
   *
   * @returns インストール結果
   * @example
   * await promptInstall();
   */
  async function promptInstall(): Promise<PromptOutcome> {
    if (!deferredPrompt) return "unavailable";

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  }

  const shouldShow =
    !isStandalone &&
    !isDismissed &&
    (visitCount === 1 || visitCount === 3) &&
    (Boolean(deferredPrompt) || isIosSafari);

  return {
    isStandalone,
    isIosSafari,
    shouldShow,
    visitCount,
    promptInstall,
    dismissForDays,
  };
}
