"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Camera, ChevronRight, Map, Sparkles, Stamp, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { ONBOARDING_COMPLETED_KEY } from "@/lib/config";

const steps = [
  {
    title: "岩手の旅先を見つけよう",
    copy: "地図とスポット検索から、今いる場所や気分に合う旅先をすばやく探せます。",
    icon: Map,
  },
  {
    title: "キャラクターと旅の思い出を",
    copy: "カメラ機能で、岩手の旅先にキャラクターを重ねた記念ショットを残せます。",
    icon: Camera,
  },
  {
    title: "スタンプを集めて岩手マスターに",
    copy: "各地のスポットを巡りながらスタンプを集め、旅の進捗を残しましょう。",
    icon: Stamp,
  },
] as const;

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
 * 初回訪問ユーザー向けオンボーディング。
 *
 * @returns OnboardingOverlay
 * @example
 * <OnboardingOverlay />
 */
export function OnboardingOverlay() {
  const pathname = usePathname();
  const isMobileViewport = useIsMobileViewport();
  const hasCompleted = useSyncExternalStore(
    subscribeOnboardingStatus,
    getOnboardingCompletedSnapshot,
    getOnboardingCompletedServerSnapshot
  );
  const [isDismissed, setIsDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const visible = !hasCompleted && !isDismissed;
  const hiddenRoute = useMemo(
    () => pathname.startsWith("/studio") || pathname.startsWith("/admin"),
    [pathname]
  );
  const shouldRender = visible && !hiddenRoute && isMobileViewport;

  useEffect(() => {
    if (!shouldRender || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRender]);

  /**
   * オンボーディングを完了扱いにする。
   *
   * @returns なし
   * @example
   * closeOnboarding();
   */
  function closeOnboarding(): void {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
      window.dispatchEvent(new Event(ONBOARDING_STATUS_EVENT));
    }
    setIsDismissed(true);
  }

  /**
   * 指定されたオンボーディング手順へ移動する。
   *
   * @param index - 移動先の手順インデックス
   * @returns なし
   * @example
   * moveToStep(1);
   */
  function moveToStep(index: number): void {
    setStepIndex(index);
  }

  if (!shouldRender) return null;

  const step = steps[stepIndex];

  return (
    <div className="fixed inset-0 z-[1300] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_36%),linear-gradient(180deg,#f8fbfa_0%,#edf7f3_54%,#f8fbfa_100%)] px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:hidden">
      <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center sm:max-w-md">
        <div className="flex items-center justify-between">
          <button
            className="rounded-full px-3 py-2 text-sm text-emerald-900/70"
            onClick={closeOnboarding}
          >
            スキップ
          </button>
          <button
            aria-label="閉じる"
            className="rounded-full border border-emerald-900/10 bg-white/80 p-2 text-emerald-900/70"
            onClick={closeOnboarding}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center py-4">
          <section className="w-full rounded-[1.75rem] border border-white/60 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,28,26,0.12)] backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
            <div aria-label="オンボーディングの進捗" className="mb-5 flex gap-2 sm:mb-6">
              {steps.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  aria-current={index === stepIndex ? "step" : undefined}
                  aria-label={`${index + 1}ページ目へ移動: ${item.title}`}
                  className={`group flex h-6 flex-1 items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                    index === stepIndex ? "cursor-default" : "cursor-pointer"
                  }`}
                  onClick={() => moveToStep(index)}
                >
                  <span
                    className={`h-1.5 w-full rounded-full transition group-hover:h-2 ${
                      index === stepIndex ? "bg-emerald-700" : "bg-emerald-900/10"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="relative min-h-48 rounded-[1.35rem] bg-[linear-gradient(160deg,rgba(15,58,58,0.94),rgba(15,110,89,0.74))] p-5 text-white sm:min-h-56 sm:rounded-[1.5rem] sm:p-6">
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,180,120,0.2),transparent_28%)]" />
              <step.icon
                className="relative h-14 w-14 animate-[float_3.8s_ease-in-out_infinite] sm:h-[4.5rem] sm:w-[4.5rem]"
                strokeWidth={1.3}
              />
              <Sparkles className="absolute right-5 top-5 h-5 w-5 animate-pulse text-amber-200 sm:right-6 sm:top-6 sm:h-6 sm:w-6" />
              <div className="relative mt-7 sm:mt-9">
                <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-100/80 sm:text-xs sm:tracking-[0.28em]">
                  Step {stepIndex + 1}
                </p>
                <h2 className="mt-2 text-pretty font-display text-[1.55rem] leading-[1.12] sm:text-3xl sm:leading-tight">
                  {step.title}
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-emerald-900/75 sm:mt-6 sm:leading-7">
              {step.copy}
            </p>

            <div className="mt-6 flex gap-3 sm:mt-8">
              {stepIndex < steps.length - 1 ? (
                <Button
                  className="flex-1 justify-center gap-2"
                  onClick={() => setStepIndex((current) => current + 1)}
                >
                  次へ
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="flex-1 justify-center" onClick={closeOnboarding}>
                  はじめる
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
