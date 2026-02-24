"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navIcons, IconKey } from "@/lib/icons";

type NavItem = { href: string; label: string; icon: IconKey };

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/camera", label: "Camera", icon: "camera" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/spot", label: "Map", icon: "spot" },
  { href: "/character", label: "Character", icon: "character" },
];

export function MobileNav() {
  const pathname = usePathname();
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (adminRoute) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/90 pb-safe backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.08)] sm:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-3 py-3">
        {navItems.map((item) => {
          const Icon = navIcons[item.icon];
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
                active
                  ? "bg-emerald-100 text-[#0f3a3a] ring-1 ring-emerald-200"
                  : "text-emerald-900/70 hover:bg-emerald-50"
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
