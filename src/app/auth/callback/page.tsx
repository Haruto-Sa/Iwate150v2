"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

/**
 * OAuth PKCE フローのコールバックページ。
 *
 * Supabase が OAuth プロバイダ認証後にリダイレクトしてくる URL。
 * `?code=xxx` パラメータを受け取り、`exchangeCodeForSession` でセッションを確立する。
 *
 * @returns AuthCallbackPage コンポーネント
 * @example
 * // Supabase が自動的に /auth/callback?code=xxx へリダイレクト
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      router.replace("/login");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      router.replace("/login?error=supabase_unavailable");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          console.error("[auth/callback] code exchange failed:", exchangeError.message);
          setError(exchangeError.message);
          setTimeout(() => {
            router.replace(`/login?error=${encodeURIComponent(exchangeError.message)}`);
          }, 2000);
          return;
        }
        router.replace("/");
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "不明なエラー";
        console.error("[auth/callback] unexpected error:", message);
        setError(message);
        setTimeout(() => {
          router.replace("/login?error=unexpected");
        }, 2000);
      });
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-sm text-red-600">認証に失敗しました: {error}</p>
          <p className="text-xs text-zinc-500">ログイン画面に戻ります...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="space-y-2 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-800" />
        <p className="text-sm text-zinc-600">認証処理中...</p>
      </div>
    </div>
  );
}
