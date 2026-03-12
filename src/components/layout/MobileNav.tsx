"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navIcons, type IconKey } from "@/lib/icons";
import { PUBLIC_NAV_ITEMS, SECRET_WORKSPACE_PATH } from "@/lib/config";

type NavItem = { href: string; label: string; icon: IconKey };

const navItems: NavItem[] = PUBLIC_NAV_ITEMS.map((item) => ({
  ...item,
  icon:
    item.href === "/"
      ? "home"
      : item.href === "/map"
        ? "spot"
        : item.href === "/search"
          ? "search"
          : item.href === "/character"
            ? "character"
            : "camera",
}));

export function MobileNav() {
  const pathname = usePathname();
  const secretWorkspaceRoute =
    pathname === SECRET_WORKSPACE_PATH || pathname.startsWith(`${SECRET_WORKSPACE_PATH}/`);

  if (secretWorkspaceRoute) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/90 pb-safe backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.08)] md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-3 py-3">
        {navItems.map((item) => {
          const Icon = navIcons[item.icon];
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tap-feedback group flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] font-medium transition duration-200 ${
                active
                  ? "bg-emerald-100 text-[#0f3a3a] ring-1 ring-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.14)]"
                  : "text-emerald-900/70 hover:-translate-y-0.5 hover:bg-emerald-50"
              }`}
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
