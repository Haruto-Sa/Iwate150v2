"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { Button } from "@/components/ui/Button";

type Props = {
  children: React.ReactNode;
};

/**
 * 認証なしで表示できる公開認証ルートかを判定する。
 *
 * @param pathname - 現在のパス名
 * @returns 公開認証ルートなら true
 * @example
 * isPublicAuthRoute("/login"); // true
 */
function isPublicAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

/**
 * 認証状態に応じてページ表示可否を制御するゲートコンポーネント。
 *
 * @param props - 子要素を含むプロパティ
 * @returns 認証済みまたは公開対象なら子要素、未認証なら認証案内UI
 * @example
 * <AuthGate>{children}</AuthGate>
 */
export function AuthGate({ children }: Props) {
  const { user, status } = useAuthSession();
  const pathname = usePathname();
  const [guestAllowed, setGuestAllowed] = useState(false);
  const publicAuthRoute = isPublicAuthRoute(pathname);

  useEffect(() => {
    const guest = localStorage.getItem("iwate150_guest") === "1";
    if (guest) {
      setGuestAllowed(true);
    }
  }, []);

  const enableGuest = () => {
    localStorage.setItem("iwate150_guest", "1");
    setGuestAllowed(true);
  };

  // Allow access if: session exists, guest mode enabled, or env not configured (dev fallback)
  const envConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const allowed = publicAuthRoute || Boolean(user) || guestAllowed || !envConfigured;

  if (status === "loading" && !publicAuthRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-blue-50 text-sm text-zinc-700">
        認証状態を確認しています...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#36d1dc] to-[#5b86e5] px-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white/95 p-6 shadow-xl">
          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              Iwate150
            </p>
            <h1 className="text-2xl font-bold text-zinc-900">ログインが必要です</h1>
            <p className="text-sm text-zinc-600">
              ログインすると機能をより便利に利用できます。ログインしない場合はゲストで閲覧できます。
            </p>
          </div>
          <div className="space-y-2">
            <a
              href="/login"
              className="block w-full rounded-lg bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              ログイン / 新規登録へ進む
            </a>
            <Button
              variant="outline"
              onClick={enableGuest}
              className="w-full"
            >
              ゲストで閲覧
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
