"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type CaptureDelay = 0 | 3 | 10;

/**
 * 撮影予約を一つだけ保持し、取消・準備状態の変化・非表示・離脱で破棄する。
 * @param ready - 映像と選択モデルが撮影可能か
 * @param onCapture - 同期撮影。成功ならtrue、再試行可能な失敗ならfalse
 * @returns 残り秒数、実行中状態、開始と取消操作
 * @example const timer = useCaptureTimer(ready, capture); timer.start(3);
 */
export function useCaptureTimer(ready: boolean, onCapture: () => boolean) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ ready, onCapture });

  /**
   * 保留中の撮影とカウント表示を取り消す。
   * @returns なし
   * @example timer.cancel();
   */
  const cancel = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
    locked.current = false;
    setRemaining(null);
    setBusy(false);
  }, []);

  useLayoutEffect(() => {
    latest.current = { ready, onCapture };
    // 外部の撮影予約を同期的に破棄し、次のpaintで古い取消操作を残さない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!ready) cancel();
  }, [ready, onCapture, cancel]);

  useEffect(() => {
    /**
     * バックグラウンド移行時に遅れて撮影しないよう予約を破棄する。
     * @returns なし
     * @example document.addEventListener("visibilitychange", onVisibilityChange);
     */
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") cancel();
    }
    /**
     * 遷移待ちの間にも予約撮影を残さない。
     * @param event - リンクを選択したクリック（キーボード操作を含む）
     * @returns なし
     * @example document.addEventListener("click", onNavigation, true);
     */
    function onNavigation(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("a[href]")) cancel();
    }
    document.addEventListener("click", onNavigation, true);
    window.addEventListener("popstate", cancel);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", cancel);
    return () => {
      document.removeEventListener("click", onNavigation, true);
      window.removeEventListener("popstate", cancel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", cancel);
      if (timeout.current !== null) clearTimeout(timeout.current);
    };
  }, [cancel]);

  /**
   * 即時撮影または指定秒数後の撮影を一度だけ予約する。
   * @param delay - 0、3、10秒
   * @returns なし
   * @example timer.start(10);
   */
  const start = useCallback((delay: CaptureDelay) => {
    if (locked.current || !latest.current.ready || document.visibilityState !== "visible") return;
    locked.current = true;
    setBusy(true);
    const deadline = performance.now() + delay * 1000;
    /**
     * 残り秒数を更新し、準備状態を再確認して一度だけ撮影する。
     * @returns なし
     * @example tick();
     */
    function tick() {
      timeout.current = null;
      if (!latest.current.ready || document.visibilityState !== "visible") {
        cancel();
        return;
      }
      const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setRemaining(seconds || null);
      if (seconds > 0) {
        timeout.current = setTimeout(tick, 1000);
      } else if (!latest.current.onCapture()) {
        cancel();
      }
    }
    tick();
  }, [cancel]);

  return { remaining, busy, start, cancel };
}
