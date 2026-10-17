"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  APP_DESCRIPTION,
  APP_TAGLINE,
  APP_TITLE,
  FAVORITES_PATH,
  PUBLIC_LOGIN_PATH,
  PUBLIC_NAV_ITEMS,
  SECRET_WORKSPACE_PATH,
} from "@/lib/config";

/**
 * 旅の案内と補助リンクを表示する。
 * @returns 公開画面のフッター
 * @example <Footer />
 */
export function Footer() {
  const pathname = usePathname();
  const secretWorkspaceRoute =
    pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);
  if (secretWorkspaceRoute) {
    return null;
  }

  return (
    <footer className="border-t border-emerald-900/15 bg-[#eeeee4] pb-[calc(6rem+env(safe-area-inset-bottom))] pt-10 md:pb-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 text-sm text-emerald-900/80 sm:grid-cols-[1.4fr_1fr] sm:px-6">
        <div className="space-y-2">
          <p className="font-display text-lg text-[#0f1c1a]">{APP_TITLE}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-900/70">{APP_TAGLINE}</p>
          <p className="max-w-xl text-sm leading-6 text-emerald-900/70">{APP_DESCRIPTION}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 text-sm">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-11 items-center transition hover:text-[#0f3a3a] hover:underline">
              {item.label}
            </Link>
          ))}
          <Link href={FAVORITES_PATH} className="flex min-h-11 items-center transition hover:text-[#0f3a3a] hover:underline">
            お気に入り
          </Link>
          <Link href={PUBLIC_LOGIN_PATH} className="flex min-h-11 items-center transition hover:text-[#0f3a3a] hover:underline">
            ログイン
          </Link>
        </div>
      </div>
    </footer>
  );
}
