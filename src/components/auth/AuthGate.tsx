"use client";

import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PUBLIC_LOGIN_PATH } from "@/lib/config";
import { useAuthSession } from "@/components/auth/SessionProvider";

type Props = {
  children: React.ReactNode;
  title: string;
  description: string;
  loginLabel?: string;
};

/**
 * 保存系機能だけに使う認証誘導ゲート。
 *
 * @param props - 表示設定
 * @returns 認証済みなら children、未認証なら誘導 UI
 * @example
 * <AuthGate title="Favorites" description="保存にはログインが必要です。">{children}</AuthGate>
 */
export function AuthGate({ children, title, description, loginLabel = "Continue with login" }: Props) {
  const { status, user } = useAuthSession();

  if (status === "loading") {
    return (
      <div className="rounded-3xl border border-emerald-900/10 bg-white/80 p-6 text-sm text-emerald-900/70 shadow-sm">
        アカウント状態を確認しています...
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-[28px] border border-emerald-900/10 bg-gradient-to-br from-[#effcf5] via-white to-[#eef6ff] p-6 shadow-sm ring-1 ring-emerald-900/10">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
            Save your trip
          </p>
          <h2 className="text-xl font-semibold text-[#0f1c1a]">{title}</h2>
          <p className="text-sm leading-6 text-emerald-900/75">{description}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={PUBLIC_LOGIN_PATH}>
              <Button>{loginLabel}</Button>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-emerald-900/75 transition hover:bg-emerald-50"
            >
              Explore first
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
