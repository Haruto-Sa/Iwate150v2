"use client";

import { useMenuLanguage } from "@/lib/menuLanguage";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  const { language, messages } = useMenuLanguage();
  const pathname = usePathname();
  const secretWorkspaceRoute =
    pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);
  if (secretWorkspaceRoute) {
    return null;
  }

  return (
    <footer lang={language} className="border-t border-app-line/15 bg-app-surface-subtle pb-[calc(6rem+env(safe-area-inset-bottom))] pt-10 md:pb-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 text-sm text-app-ink/80 sm:grid-cols-[1.4fr_1fr] sm:px-6">
        <div className="space-y-2">
          <p className="font-display text-lg text-app-ink-strong">{APP_TITLE}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 text-sm">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-11 items-center transition hover:text-app-accent-ink hover:underline">
              {messages[item.messageKey]}
            </Link>
          ))}
          <Link href={FAVORITES_PATH} className="flex min-h-11 items-center transition hover:text-app-accent-ink hover:underline">
            {messages.favorites}
          </Link>
          <Link href={PUBLIC_LOGIN_PATH} className="flex min-h-11 items-center transition hover:text-app-accent-ink hover:underline">
            {messages.login}
          </Link>
        </div>
      </div>
    </footer>
  );
}
