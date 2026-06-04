"use client";

import { useEffect } from "react";

/**
 * iOS Safari でも確実に効くスクロールロックの内部状態。
 *
 * `body { overflow: hidden }` のみでは iOS Safari がスクロールを止められず、
 * 解除後にスクロール不能になる既知の不具合があるため、`position: fixed` 方式を用いる。
 * 複数のオーバーレイ（オンボーディング / BottomSheet 等）が同時にロックしても
 * 衝突しないように参照カウントで一元管理する。
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyles: {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
} | null = null;

/**
 * body をスクロール不能にする（最初のロック取得時のみ適用）。
 *
 * @returns なし
 * @example
 * applyBodyLock();
 */
function applyBodyLock(): void {
  const { body } = document;
  savedScrollY = window.scrollY;
  savedStyles = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
  };
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
}

/**
 * body のスクロールロックを解除し、元のスクロール位置へ戻す。
 *
 * @returns なし
 * @example
 * releaseBodyLock();
 */
function releaseBodyLock(): void {
  const { body } = document;
  if (savedStyles) {
    body.style.overflow = savedStyles.overflow;
    body.style.position = savedStyles.position;
    body.style.top = savedStyles.top;
    body.style.left = savedStyles.left;
    body.style.right = savedStyles.right;
    body.style.width = savedStyles.width;
    savedStyles = null;
  }
  // fixed 解除に伴うスクロール飛びを防ぐため元位置へ復元する
  window.scrollTo(0, savedScrollY);
}

/**
 * `active` の間だけ body のスクロールをロックする（iOS Safari 対応）。
 *
 * @param active - ロックを有効化するか
 * @returns なし
 * @example
 * useBodyScrollLock(isOverlayOpen);
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    lockCount += 1;
    if (lockCount === 1) {
      applyBodyLock();
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        releaseBodyLock();
      }
    };
  }, [active]);
}
