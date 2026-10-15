"use client";

import { useEffect, useState } from "react";

type PhotoBuilder = () => Promise<Blob | null>;
type PreparedPhoto = {
  source: PhotoBuilder;
  file: File | null;
  error: string | null;
};

/**
 * 編集世代に一致する写真だけを返す。共有タップ後には画像生成を待たない。
 * @param build - 編集内容が変わるたびに参照が変わる画像生成関数
 * @param enabled - 撮影画像がある場合のみ生成する
 * @returns 最新の写真、準備状態、再試行操作
 * @example const photo = usePreparedPhoto(generateImage, Boolean(capture));
 */
export function usePreparedPhoto(build: PhotoBuilder, enabled: boolean) {
  const [result, setResult] = useState<PreparedPhoto | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      const timeout = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error("Photo preparation timed out")), 10_000);
      });
      // Promise.resolve によって生成関数の同期例外も同じエラー経路に集約する。
      void Promise.race([Promise.resolve().then(build), timeout])
        .then((blob) => {
          if (!blob) throw new Error("Photo is empty");
          if (!disposed) {
            setResult({ source: build, file: new File([blob], "iwate-memory.png", { type: "image/png" }), error: null });
          }
        })
        .catch(() => {
          if (!disposed) setResult({ source: build, file: null, error: "写真を準備できませんでした。もう一度お試しください。" });
        })
        .finally(() => clearTimeout(deadline));
    }, 150);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(deadline);
    };
  }, [build, enabled, attempt]);

  // effectの実行前も旧世代のFileを公開しない。遅れて完了した生成はcleanupで破棄する。
  const current = enabled && result?.source === build ? result : null;

  /**
   * 失敗した画像生成を再実行する。
   * @returns なし
   * @example retry();
   */
  function retry() {
    setResult(null);
    setAttempt((value) => value + 1);
  }

  return { file: current?.file ?? null, error: current?.error ?? null, preparing: enabled && !current, retry };
}
