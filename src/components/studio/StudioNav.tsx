"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/studio", label: "Dashboard" },
  { href: "/studio/spots", label: "Spots" },
  { href: "/studio/events", label: "Events" },
];

/**
 * Studio のプライマリナビゲーション。
 *
 * @returns ナビゲーション UI
 * @example
 * <StudioNav />
 */
export function StudioNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Studio navigation">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-emerald-900 text-white shadow-sm"
                : "bg-app-surface text-app-ink ring-1 ring-app-line/10 hover:bg-app-surface-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

