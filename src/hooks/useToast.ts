"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

/**
 * シンプルなトースト通知を管理するカスタムフック。
 *
 * コンポーネントに依存せず、`show` を呼ぶだけでトーストを表示できる。
 * 各トーストは `duration` ms 後に自動的に消える。
 *
 * @param duration - 自動消去までのミリ秒（デフォルト 3000ms）
 * @returns `toasts` と `show` 関数のオブジェクト
 * @example
 * const { toasts, show } = useToast();
 * show("URLをコピーしました", "success");
 */
export function useToast(duration = 3000) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss, duration]
  );

  // アンマウント時に全タイマーをクリア
  useEffect(() => {
    const ref = timers.current;
    return () => {
      ref.forEach((t) => clearTimeout(t));
    };
  }, []);

  return { toasts, show, dismiss };
}
