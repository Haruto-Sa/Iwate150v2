"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, LogIn, LogOut, Sparkles } from "lucide-react";
import {
  APP_TAGLINE,
  APP_TITLE,
  FAVORITES_PATH,
  PUBLIC_LOGIN_PATH,
  PUBLIC_NAV_ITEMS,
  SECRET_WORKSPACE_PATH,
} from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/components/auth/SessionProvider";

/**
 * Secret workspace 配下かを返す。
 *
 * @param pathname - 現在パス
 * @returns secret route の場合 true
 * @example
 * isSecretWorkspaceRoute("/studio");
 */
function isSecretWorkspaceRoute(pathname: string): boolean {
  return pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);
}

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = useAuthSession();
  const secretWorkspaceRoute = isSecretWorkspaceRoute(pathname);

  if (secretWorkspaceRoute) {
    return (
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={SECRET_WORKSPACE_PATH} className="text-sm font-semibold tracking-wide text-zinc-900">
            Studio Workspace
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700">
              Public Site
            </Link>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-white/90 to-white/70 backdrop-blur-2xl shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3 text-[#0f1c1a]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 ring-1 ring-emerald-200/70 transition group-hover:scale-105 group-hover:ring-emerald-400">
            <Compass className="h-5 w-5 text-[#0f3a3a]" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-xl">{APP_TITLE}</p>
            <p className="truncate text-[11px] uppercase tracking-[0.2em] text-emerald-900/70">
              {APP_TAGLINE}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-medium text-[#0f1c1a] md:flex">
          {PUBLIC_NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`tap-feedback rounded-full px-3 py-1.5 transition duration-200 ${
                  active
                    ? "bg-emerald-100 text-[#0f3a3a] ring-1 ring-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.14)]"
                    : "text-emerald-900/70 hover:-translate-y-0.5 hover:bg-emerald-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href={FAVORITES_PATH}
            className="tap-feedback flex items-center gap-1 rounded-full px-3 py-1.5 text-emerald-900/80 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
          >
            <Heart className="h-4 w-4" />
            Favorites
          </Link>
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          ) : (
            <Link
              href={PUBLIC_LOGIN_PATH}
              className="tap-feedback flex items-center gap-1 rounded-full bg-emerald-950 px-3 py-1.5 text-white transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-900 hover:shadow-[0_16px_32px_rgba(6,78,59,0.24)]"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-3 py-2 text-xs text-emerald-900/70 sm:flex md:hidden">
          <Sparkles className="h-4 w-4 text-emerald-700" />
          Save favorites after you explore
        </div>
      </div>
    </header>
  );
}
