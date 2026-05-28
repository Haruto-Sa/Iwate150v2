"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { navIcons, type IconKey } from "@/lib/icons";
import {
  FAVORITES_PATH,
  LEGACY_GUIDE_PATH,
  MOBILE_NAV_ITEMS,
  MORE_MENU_ITEMS,
  PUBLIC_LOGIN_PATH,
  SECRET_WORKSPACE_PATH,
  STAMPS_PATH,
} from "@/lib/config";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/components/auth/SessionProvider";

type NavItem = { href: string; label: string; icon: IconKey };
const navItems: readonly NavItem[] = MOBILE_NAV_ITEMS;

export function MobileNav() {
  const pathname = usePathname();
  const { signOut, user } = useAuthSession();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const secretWorkspaceRoute =
    pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);
  const isMoreRoute =
    pathname.startsWith("/character") ||
    pathname.startsWith(STAMPS_PATH) ||
    pathname.startsWith(FAVORITES_PATH) ||
    pathname.startsWith(LEGACY_GUIDE_PATH) ||
    pathname.startsWith(PUBLIC_LOGIN_PATH);

  if (secretWorkspaceRoute) {
    return null;
  }

  /**
   * 現在選択中タブ向けの強調スタイルを返す。
   *
   * カメラ専用だった濃色アクセントを、モバイル下部ナビのアクティブ項目全般へ適用する。
   *
   * @param active - 現在タブが選択中か
   * @returns クラス文字列
   * @example
   * getPrimaryActiveClass(true);
   */
  function getPrimaryActiveClass(active: boolean): string {
    if (!active) {
      return "text-emerald-900/70 hover:-translate-y-0.5 hover:bg-emerald-50";
    }
    return "relative -mt-6 rounded-[1.35rem] bg-[#0f3a3a] px-3 py-3 text-white shadow-[0_18px_30px_rgba(15,58,58,0.28)]";
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/90 pb-safe backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.08)] md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-3 py-3">
        {navItems.map((item) => {
          const Icon = navIcons[item.icon];
          const active =
            item.href === "#more"
              ? isMoreRoute
              : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          if (item.href === "#more") {
            return (
              <button
                key={item.href}
                className={`tap-feedback group flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] font-medium transition duration-200 ${
                  active
                    ? "bg-emerald-100 text-[#0f3a3a] ring-1 ring-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.14)]"
                    : "text-emerald-900/70 hover:-translate-y-0.5 hover:bg-emerald-50"
                }`}
                onClick={() => setIsMoreOpen(true)}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                <span className="mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tap-feedback group flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] font-medium transition duration-200 ${getPrimaryActiveClass(
                active
              )}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <BottomSheet open={isMoreOpen} title="その他" onClose={() => setIsMoreOpen(false)}>
        <div className="space-y-3">
          {MORE_MENU_ITEMS.map((item) => {
            const Icon = navIcons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 rounded-[1.5rem] border border-emerald-900/10 bg-white/80 px-4 py-4"
                onClick={() => setIsMoreOpen(false)}
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-[#0f3a3a]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-[#0f1c1a]">{item.label}</span>
                  <span className="block text-sm text-emerald-900/65">{item.description}</span>
                </span>
              </Link>
            );
          })}

          <Link
            href={user ? FAVORITES_PATH : PUBLIC_LOGIN_PATH}
            className="flex items-center justify-between rounded-[1.5rem] border border-emerald-900/10 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900"
            onClick={() => setIsMoreOpen(false)}
          >
            <span>{user ? "マイページ" : "ログイン"}</span>
            <span className="text-emerald-900/55">{user ? "お気に入りと進捗を見る" : "保存機能を使う"}</span>
          </Link>

          {user && (
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={() => {
                void signOut();
                setIsMoreOpen(false);
              }}
            >
              ログアウト
            </Button>
          )}
        </div>
      </BottomSheet>
    </nav>
  );
}
