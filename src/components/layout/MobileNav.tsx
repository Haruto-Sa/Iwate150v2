"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navIcons, type IconKey } from "@/lib/icons";
import { MOBILE_NAV_ITEMS, SECRET_WORKSPACE_PATH } from "@/lib/config";

type NavItem = { href: string; label: string; icon: IconKey };
const navItems: readonly NavItem[] = MOBILE_NAV_ITEMS;

/**
 * 主要5画面へ移動するモバイル下部ナビ。
 * @returns ナビゲーション。Studio配下ではnull
 * @example <MobileNav />
 */
export function MobileNav() {
  const pathname = usePathname();
  const secretWorkspaceRoute =
    pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);
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
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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
    </nav>
  );
}
