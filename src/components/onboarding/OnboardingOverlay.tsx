"use client";

import { useMenuLanguage } from "@/lib/menuLanguage";
import { MenuLanguageSelect } from "@/components/preferences/MenuLanguageSelect";

import { useEffect, useRef, useState } from "react";
import { Camera, ArrowRight, Search, Stamp, X, CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getGuidePath, pageGuides, type GuidePath } from "@/lib/pageGuides";
import { completePageGuide, usePageGuideCompleted } from "@/hooks/usePageGuideCompleted";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";



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
  const path = getGuidePath(usePathname());
  return path ? <PageGuide key={path} path={path} /> : null;
}

/**
 * 初回案内と再表示ボタン。画面の変更時にローカル状態を破棄する。
 * @param props - 対象画面
 * @returns ヘルプボタンと案内ダイアログ
 * @example <PageGuide path="/camera" />
 */
function PageGuide({ path }: { path: GuidePath }) {
  const { language, messages } = useMenuLanguage();
  const completed = usePageGuideCompleted(path);
  const [reopened, setReopened] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shouldRender = reopened || (!completed && !dismissed);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const guide = pageGuides[path][language];
  useBodyScrollLock(shouldRender);

  useEffect(() => {
    if (!shouldRender) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, [shouldRender]);

  /** 案内を閉じてページ別既読を保存する。@returns なし @example closeOnboarding(); */
  function closeOnboarding(): void {
    completePageGuide(path);
    setDismissed(true);
    setReopened(false);
  }

  return (
    <>
    <button ref={triggerRef} type="button" lang={language} aria-label={messages.help}
      aria-haspopup="dialog" aria-expanded={shouldRender} onClick={() => setReopened(true)}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-emerald-900/15 text-emerald-900">
      <CircleHelp aria-hidden="true" className="h-5 w-5" />
    </button>
    {shouldRender && <dialog
      lang={language}
      ref={dialogRef}
      aria-labelledby="first-visit-title"
      onCancel={(event) => { event.preventDefault(); closeOnboarding(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-emerald-900/15 bg-[#f6f5ef] p-5 text-emerald-950 backdrop:bg-emerald-950/40"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="first-visit-title" className="font-display text-2xl">{guide.title}</h2>
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
      {path === "/" ? <nav aria-label={messages.startTrip} className="space-y-3">
        {destinations.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} onClick={closeOnboarding} className="flex min-h-16 items-center gap-4 rounded-2xl border border-emerald-900/15 bg-white px-4 py-4 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            <Icon aria-hidden="true" className="h-6 w-6 text-emerald-700" />
            <span className="flex-1 font-medium">{messages[label]}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ))}
      </nav> : <div className="space-y-5">
        <p className="text-sm leading-relaxed">{guide.hint}</p>
        <button type="button" onClick={closeOnboarding} className="action-link w-full">{guide.action}</button>
      </div>}
      <div className="mt-5 border-t border-emerald-900/15 pt-4"><MenuLanguageSelect /></div>
    </dialog>}
    </>
  );
}
