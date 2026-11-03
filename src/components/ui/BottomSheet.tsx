"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useModalDialog } from "@/hooks/useModalDialog";
import { useId } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  lang?: string;
  closeLabel?: string;
};

/**
 * モバイル向けボトムシート。
 *
 * @param props - 表示設定
 * @returns BottomSheet
 * @example
 * <BottomSheet open title="Menu" onClose={() => {}}>...</BottomSheet>
 */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
  className = "",
  lang,
  closeLabel,
}: Props) {
  const isMobileViewport = useIsMobileViewport();
  const shouldRender = open && isMobileViewport;
  const dialogRef = useModalDialog(shouldRender);
  const titleId = useId();

  // iOS Safari 対応のスクロールロック（解除後にスクロール不能になる不具合対策）
  useBodyScrollLock(shouldRender);

  if (!shouldRender) return null;

  return (
    <dialog
      lang={lang}
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-[2rem] bg-[#f6f5ef] text-emerald-950 backdrop:bg-black/35"
    >
      <section
        className={`px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 ${className}`}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-emerald-900/15" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-2xl text-[#0f1c1a]">
            {title}
          </h2>
          <Button
            aria-label={closeLabel ?? `${title} を閉じる`}
            variant="ghost"
            size="sm"
            className="rounded-full border border-emerald-900/10 bg-white/70"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </section>
    </dialog>
  );
}
