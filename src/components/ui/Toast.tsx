"use client";

import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import type { Toast, ToastType } from "@/hooks/useToast";

type ToastItemProps = {
  toast: Toast;
  onDismiss: (id: string) => void;
};

const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white text-emerald-900",
  error: "border-red-200 bg-white text-red-900",
  info: "border-sky-200 bg-white text-sky-900",
};

const iconColorMap: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-sky-500",
};

/**
 * 単一トーストアイテム。
 *
 * @param props.toast - トースト情報
 * @param props.onDismiss - 閉じるコールバック
 * @returns ToastItem コンポーネント
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const Icon = iconMap[toast.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl ring-1 ring-black/5 animate-in slide-in-from-bottom-4 fade-in duration-300 ${colorMap[toast.type]}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconColorMap[toast.type]}`} />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="通知を閉じる"
        className="shrink-0 rounded-full p-0.5 opacity-60 transition hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type ToastContainerProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

/**
 * トースト一覧を画面下部に表示するコンテナ。
 *
 * `useToast` フックと組み合わせて使用する。
 *
 * @param props.toasts - 表示するトースト配列
 * @param props.onDismiss - トースト消去コールバック
 * @returns ToastContainer コンポーネント
 * @example
 * const { toasts, show, dismiss } = useToast();
 * return (
 *   <>
 *     <ToastContainer toasts={toasts} onDismiss={dismiss} />
 *   </>
 * );
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="通知"
      className="fixed bottom-20 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-8"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
