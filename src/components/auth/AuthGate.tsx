"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { Button } from "@/components/ui/Button";

type Props = {
  children: React.ReactNode;
};

export function AuthGate({ children }: Props) {
  const { user, status } = useAuthSession();
  const [guestAllowed, setGuestAllowed] = useState(false);

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
  const allowed = Boolean(user) || guestAllowed || !envConfigured;

  if (status === "loading") {
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
              Supabase Auth で認証します。デバッグ目的なら「ログインなしで閲覧」を選んでください。
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
              ログインなしで閲覧（デバッグ）
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


