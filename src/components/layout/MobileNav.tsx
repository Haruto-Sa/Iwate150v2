"use client";

import { useMenuLanguage } from "@/lib/menuLanguage";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navIcons } from "@/lib/icons";
import { MOBILE_NAV_ITEMS, SECRET_WORKSPACE_PATH } from "@/lib/config";

const navItems = MOBILE_NAV_ITEMS;

/**
 * 主要5画面へ移動するモバイル下部ナビ。
 * @returns ナビゲーション。Studio配下ではnull
 * @example <MobileNav />
 */
export function MobileNav() {
  const { language, messages } = useMenuLanguage();
  const pathname = usePathname();
  const secretWorkspaceRoute =
    pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);
  if (secretWorkspaceRoute) {
    return null;
  }

  return (
    <nav lang={language} aria-label={messages.mobilePages} className="glass-nav pb-safe fixed inset-x-0 bottom-0 z-[1100] border-t md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-2">
        {navItems.map((item) => {
          const Icon = navIcons[item.icon];
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-medium transition-colors ${active ? "bg-emerald-800 text-white" : "text-emerald-900/80 hover:bg-emerald-100"}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              <span className="mt-1">{messages[item.messageKey]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
