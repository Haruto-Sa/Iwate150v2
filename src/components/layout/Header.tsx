"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TITLE } from "@/lib/config";
import { Compass, LogIn, LogOut } from "lucide-react";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { Button } from "@/components/ui/Button";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/camera", label: "Camera" },
  { href: "/search", label: "Search" },
  { href: "/spot", label: "Map" },
  { href: "/character", label: "Character" },
];

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = useAuthSession();

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-white/90 to-white/70 backdrop-blur-2xl shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2 text-lg font-semibold tracking-tight text-[#0f1c1a]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 ring-1 ring-emerald-200/70 transition group-hover:scale-105 group-hover:ring-emerald-400">
            <Compass className="h-5 w-5 text-[#0f3a3a]" strokeWidth={1.8} />
          </span>
          <div className="leading-tight">
            <p className="font-display text-xl">{APP_TITLE}</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-900/70">
              Transparent Atlas
            </p>
          </div>
        </Link>
        <nav className="hidden items-center gap-2 text-sm font-medium text-[#0f1c1a] sm:flex">
          {navItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 transition ${
                  active
                    ? "bg-emerald-100 text-[#0f3a3a] ring-1 ring-emerald-200"
                    : "text-emerald-900/70 hover:bg-emerald-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="gap-1"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-emerald-900/80 transition hover:bg-emerald-50"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
