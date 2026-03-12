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
  STAMPS_PATH,
} from "@/lib/config";

export function Footer() {
  const pathname = usePathname();
  const secretWorkspaceRoute =
    pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);
  if (secretWorkspaceRoute) {
    return null;
  }

  return (
    <footer className="border-t border-emerald-100/80 bg-white/80 pb-20 pt-8 backdrop-blur-xl sm:pb-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 text-sm text-emerald-900/80 sm:grid-cols-[1.4fr_1fr] sm:px-6">
        <div className="space-y-2">
          <p className="font-display text-lg text-[#0f1c1a]">{APP_TITLE}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-900/70">{APP_TAGLINE}</p>
          <p className="max-w-xl text-sm leading-6 text-emerald-900/70">{APP_DESCRIPTION}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[#0f3a3a] hover:underline">
              {item.label}
            </Link>
          ))}
          <Link href={STAMPS_PATH} className="transition hover:text-[#0f3a3a] hover:underline">
            Stamps
          </Link>
          <Link href={FAVORITES_PATH} className="transition hover:text-[#0f3a3a] hover:underline">
            Favorites
          </Link>
          <Link href={PUBLIC_LOGIN_PATH} className="transition hover:text-[#0f3a3a] hover:underline">
            Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
