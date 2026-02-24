"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TAGLINE, APP_TITLE } from "@/lib/config";

export function Footer() {
  const pathname = usePathname();
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  if (adminRoute) {
    return null;
  }

  return (
    <footer className="border-t border-emerald-100/80 bg-white/80 pb-20 pt-6 backdrop-blur-xl sm:pb-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 text-sm text-emerald-900/80 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-lg text-[#0f1c1a]">{APP_TITLE}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-900/70">{APP_TAGLINE}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
          <Link href="/map" className="transition hover:text-[#0f3a3a] hover:underline">
            Map
          </Link>
          <Link href="/search" className="transition hover:text-[#0f3a3a] hover:underline">
            Search
          </Link>
          <Link href="/character" className="transition hover:text-[#0f3a3a] hover:underline">
            Character
          </Link>
          <Link href="/stamp" className="transition hover:text-[#0f3a3a] hover:underline">
            Stamp
          </Link>
          <Link href="/login" className="transition hover:text-[#0f3a3a] hover:underline">
            Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
