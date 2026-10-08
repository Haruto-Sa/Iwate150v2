"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, X } from "lucide-react";
import { FAVORITES_PATH, MORE_MENU_ITEMS, PUBLIC_LOGIN_PATH } from "@/lib/config";
import { navIcons } from "@/lib/icons";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { Button } from "@/components/ui/Button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

/**
 * ヘッダー右端から補助ページとアカウント操作を開く。
 * @returns その他ボタンとモーダルメニュー
 * @example <MoreMenu />
 */
export function MoreMenu() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [previousPath, setPreviousPath] = useState(pathname);
  // 戻る操作でも以前開いたメニューが再表示されないよう、ページ変更で状態を破棄する。
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setOpenPath(null);
  }
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const open = openPath === pathname;
  const active = [...MORE_MENU_ITEMS.map((item) => item.href), PUBLIC_LOGIN_PATH].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpenPath(pathname)}
        className={`tap-feedback flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium text-emerald-950 ring-1 ring-emerald-900/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${active ? "bg-emerald-100" : "bg-white/70"}`}
      >
        <MoreHorizontal aria-hidden="true" className="h-5 w-5" />その他
      </button>
      {open && (
        <MoreMenuDialog id={dialogId} onClose={() => setOpenPath(null)} restoreFocus={() => triggerRef.current?.focus()} />
      )}
    </>
  );
}

/**
 * PCとモバイルで利用可能な補助ナビゲーション。
 * @param props - ダイアログID、終了処理、起動ボタンへのフォーカス復帰処理
 * @returns top layerに表示するメニュー
 * @example <MoreMenuDialog id="more" onClose={close} restoreFocus={restore} />
 */
function MoreMenuDialog({ id, onClose, restoreFocus }: {
  id: string; onClose: () => void; restoreFocus: () => void;
}) {
  const { user, signOut } = useAuthSession();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef(restoreFocus);
  const titleId = useId();
  useBodyScrollLock(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    const restore = restoreFocusRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      restore();
    };
  }, []);

  return createPortal(
    <dialog
      id={id}
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={onClose}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-[2rem] border border-emerald-100 bg-white/95 p-5 text-[#0f1c1a] shadow-2xl backdrop:bg-emerald-950/40 backdrop:backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-display text-2xl">その他</h2>
        <Button autoFocus aria-label="その他を閉じる" variant="ghost" size="sm" onClick={onClose}>
          <X aria-hidden="true" className="h-5 w-5" />
        </Button>
      </div>
      <nav aria-label="その他のページ" className="space-y-3">
        {MORE_MENU_ITEMS.map((item) => {
          const Icon = navIcons[item.icon];
          return (
            <Link key={item.href} href={item.href} onClick={onClose} className="flex items-center gap-4 rounded-2xl border border-emerald-900/10 bg-emerald-50/70 px-4 py-4">
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700" />
              <span>
                <span className="block font-medium">{item.label}</span>
                <span className="block text-sm text-emerald-900/65">{item.description}</span>
              </span>
            </Link>
          );
        })}
        <Link href={user ? FAVORITES_PATH : PUBLIC_LOGIN_PATH} onClick={onClose} className="block rounded-2xl border border-emerald-900/10 px-4 py-4 text-sm text-emerald-900">
          {user ? "マイページ" : "ログイン"}
        </Link>
        {user && <Button variant="outline" className="w-full" onClick={() => { void signOut(); onClose(); }}>ログアウト</Button>}
      </nav>
    </dialog>, document.body
  );
}
