"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type Destination = { url: string; hostname: string };

/**
 * HTTP(S)の遷移先だけを受け付ける。
 * @param href - 遷移先URL
 * @returns 正規化した遷移先。不正なURLはnull
 * @example resolveExternalDestination("https://example.com");
 */
export function resolveExternalDestination(href: string): Destination | null {
  try {
    const url = new URL(href);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return { url: url.href, hostname: url.hostname };
  } catch {
    return null;
  }
}

/**
 * 外部遷移の依頼と確認UIを共有する。
 * @returns 確認依頼関数と描画する確認要素
 * @example const { requestNavigation, confirmation } = useExternalNavigation();
 */
export function useExternalNavigation() {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestNavigation = useCallback((href: string, trigger?: HTMLElement) => {
    setOpener(trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    const next = resolveExternalDestination(href);
    setError(next ? null : "リンク先が不正なため、外部サイトを開けません。");
    setDestination(next);
  }, []);

  return {
    requestNavigation,
    confirmation: (
      <>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {destination && (
          <ExternalNavigationDialog destination={destination} opener={opener} onClose={() => setDestination(null)} />
        )}
      </>
    ),
  };
}

/**
 * 確認操作まで外部URLを開かない関連リンクボタン。
 * @param props - URL、表示名とスタイル
 * @returns 関連リンクと確認UI
 * @example <ConfirmedExternalLink href="https://example.com">関連リンク</ConfirmedExternalLink>
 */
export function ConfirmedExternalLink({ href, children, className }: {
  href: string; children: React.ReactNode; className?: string;
}) {
  const { requestNavigation, confirmation } = useExternalNavigation();
  return (
    <>
      <button type="button" className={className} onClick={(event) => requestNavigation(href, event.currentTarget)}>{children}</button>
      {confirmation}
    </>
  );
}

/**
 * 地図の重なり順に影響されない、外部遷移のモーダル確認。
 * @param props - 検証済み遷移先と終了処理
 * @returns bodyへ配置するネイティブダイアログ
 * @example <ExternalNavigationDialog destination={destination} onClose={close} />
 */
function ExternalNavigationDialog({ destination, opener, onClose }: {
  destination: Destination; opener: HTMLElement | null; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useBodyScrollLock(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[2rem] border border-emerald-100 bg-white/95 p-6 text-[#0f1c1a] shadow-2xl backdrop:bg-emerald-950/40 backdrop:backdrop-blur-sm"
    >
      <ExternalLink aria-hidden="true" className="mb-4 h-6 w-6 text-emerald-700" />
      <h2 id={titleId} className="text-xl font-semibold">外部サイトへ移動します</h2>
      <p id={descriptionId} className="mt-3 text-sm text-emerald-900/80">
        新しいタブで外部サイトを開きます。端末によっては地図アプリが起動する場合があります。
      </p>
      <p className="mt-4 break-all rounded-xl bg-emerald-50 px-4 py-3 text-sm">{destination.hostname}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button autoFocus variant="outline" onClick={onClose}>キャンセル</Button>
        <a
          href={destination.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="rounded-full bg-[#0f3a3a] px-5 py-3 text-center text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >外部サイトを開く</a>
      </div>
    </dialog>, document.body
  );
}
