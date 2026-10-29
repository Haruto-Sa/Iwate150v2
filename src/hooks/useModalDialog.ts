"use client";

import { useEffect, useRef } from "react";

/**
 * ネイティブdialogで背景を操作不能にし、終了時に元のフォーカスを戻す。
 * @param open - 表示するか
 * @returns dialogに渡す参照
 * @example const ref = useModalDialog(open); return open ? <dialog ref={ref}>内容</dialog> : null;
 */
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
