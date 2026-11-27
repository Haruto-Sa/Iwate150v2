"use client";

import { useMenuLanguage } from "@/lib/menuLanguage";
import { MenuLanguageSelect } from "@/components/preferences/MenuLanguageSelect";

import { useMemo, useState } from "react";
import { Camera, ArrowRight, Search, Stamp, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { completeOnboarding, useOnboardingCompleted } from "@/hooks/useOnboardingCompleted";
import { useModalDialog } from "@/hooks/useModalDialog";

const destinations = [
  { label: "findPlaces", href: "/search", icon: Search },
  { label: "takePhoto", href: "/camera", icon: Camera },
  { label: "viewStamps", href: "/stamps", icon: Stamp },
] as const;

/**
 * 初回訪問ユーザー向けオンボーディング。
 *
 * @returns OnboardingOverlay
 * @example
 * <OnboardingOverlay />
 */
export function OnboardingOverlay() {
  const { language, messages } = useMenuLanguage();
  const pathname = usePathname();
  const isMobileViewport = useIsMobileViewport();
  const hasCompleted = useOnboardingCompleted();
  const [isDismissed, setIsDismissed] = useState(false);
  const visible = !hasCompleted && !isDismissed;
  const hiddenRoute = useMemo(
    () => pathname.startsWith("/studio") || pathname.startsWith("/admin"),
    [pathname]
  );
  const shouldRender = visible && !hiddenRoute && isMobileViewport;
  const dialogRef = useModalDialog(shouldRender);

  // iOS Safari でも確実に効くスクロールロック（解除後にスクロール不能になる不具合対策）
  useBodyScrollLock(shouldRender);

  /**
   * オンボーディングを完了扱いにする。
   *
   * @returns なし
   * @example
   * closeOnboarding();
   */
  function closeOnboarding(): void {
    completeOnboarding();
    setIsDismissed(true);
  }

  if (!shouldRender) return null;

  return (
    <dialog
      lang={language}
      ref={dialogRef}
      aria-labelledby="first-visit-title"
      onCancel={(event) => { event.preventDefault(); closeOnboarding(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-emerald-900/15 bg-[#f6f5ef] p-5 text-emerald-950 backdrop:bg-emerald-950/40"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="first-visit-title" className="font-display text-2xl">{messages.tripMenu}</h2>
        <button
          autoFocus
          type="button"
          aria-label={messages.close}
          className="grid h-11 w-11 place-items-center rounded-full border border-emerald-900/15 bg-white"
          onClick={closeOnboarding}
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <nav aria-label={messages.startTrip} className="space-y-3">
        {destinations.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} onClick={closeOnboarding} className="flex min-h-16 items-center gap-4 rounded-2xl border border-emerald-900/15 bg-white px-4 py-4 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            <Icon aria-hidden="true" className="h-6 w-6 text-emerald-700" />
            <span className="flex-1 font-medium">{messages[label]}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ))}
      </nav>
      <div className="mt-5 border-t border-emerald-900/15 pt-4"><MenuLanguageSelect /></div>
    </dialog>
  );
}
