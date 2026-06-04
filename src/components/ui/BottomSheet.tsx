"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

/**
 * モバイル向けボトムシート。
 *
 * @param props - 表示設定
 * @returns BottomSheet
 * @example
 * <BottomSheet open title="Menu" onClose={() => {}}>...</BottomSheet>
 */
export function BottomSheet({ open, title, onClose, children, className = "" }: Props) {
  const isMobileViewport = useIsMobileViewport();
  const shouldRender = open && isMobileViewport;

  // iOS Safari 対応のスクロールロック（解除後にスクロール不能になる不具合対策）
  useBodyScrollLock(shouldRender);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/35 backdrop-blur-sm md:hidden">
      <button
        aria-label="閉じる"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        aria-modal="true"
        role="dialog"
        className={`relative w-full rounded-t-[2rem] border border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,250,246,0.98))] px-5 pb-8 pt-4 shadow-[0_-24px_60px_rgba(15,28,26,0.18)] ${className}`}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-emerald-900/15" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-[#0f1c1a]">{title}</h2>
          <Button
            aria-label={`${title} を閉じる`}
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
    </div>
  );
}
