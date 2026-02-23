"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { Button } from "@/components/ui/Button";
import {
  getConfiguredOAuthProviders,
  getOAuthProviderLabel,
  isUnsupportedOAuthProviderError,
  normalizeAuthError,
  type OAuthProvider,
} from "@/lib/auth";

/**
 * ログイン/新規登録ページ。
 *
 * Supabase Auth（メール+パスワード / OAuth）で認証状態を管理する。
 *
 * @returns LoginPage コンポーネント
 * @example
 * <LoginPage />
 */
export default function LoginPage() {
  const supabase = getSupabaseClient();
  const { user, signOut, refreshSession, status } = useAuthSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const canUseSupabaseAuth = useMemo(() => Boolean(supabase), [supabase]);
  const oauthProviders = useMemo(() => getConfiguredOAuthProviders(), []);
  const [disabledOauthProviders, setDisabledOauthProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!user?.email) return;
    setEmail(user.email);
  }, [status, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!supabase) {
      setMessage("現在ログイン機能を利用できません。しばらくしてからお試しください。");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setMessage(normalizeAuthError(error.message));
      } else {
        setMessage("確認メールを送信しました。メール内のリンクをクリック後、ログインしてください。");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setMessage(normalizeAuthError(error.message));
    } else {
      await refreshSession();
      setMessage("ログインしました。");
      router.push("/");
    }
  };

  /**
   * Supabase OAuth ログインを開始する。
   *
   * @param provider - OAuth プロバイダ名
   * @returns Promise<void>
   * @example
   * await handleOAuth("google");
   */
  const handleOAuth = async (provider: "google" | "github") => {
    if (!supabase) {
      setMessage("現在このログイン方法を利用できません。");
      return;
    }
    if (disabledOauthProviders.includes(provider)) {
      setMessage(
        `${getOAuthProviderLabel(provider)} ログインは現在利用できません。`
      );
      return;
    }
    setMessage(null);
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      const normalized = normalizeAuthError(error.message, provider);
      setMessage(normalized);
      if (isUnsupportedOAuthProviderError(error.message)) {
        setDisabledOauthProviders((prev) => (
          prev.includes(provider) ? prev : [...prev, provider]
        ));
      }
    }
  };

  const enableGuest = () => {
    localStorage.setItem("iwate150_guest", "1");
    setMessage("ゲストモードで閲覧できます。");
    router.push("/");
  };

  const handleSignOut = async () => {
    await signOut();
    setMessage("サインアウトしました。");
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">ログイン</h1>
        <p className="text-sm text-zinc-600">
          メールアドレスまたは外部アカウントでログインできます。
        </p>
        <p className="text-sm text-zinc-600">
          イベント主導の旅プランをそのまま地図・カメラ・スタンプへ繋げられるアプリです。ログインすると保存やシェアが便利になります。
        </p>
      </div>

      {user && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ログイン中: {user.email}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant={mode === "signin" ? "primary" : "outline"}
          size="sm"
          onClick={() => setMode("signin")}
          className="flex-1"
        >
          ログイン
        </Button>
        <Button
          variant={mode === "signup" ? "primary" : "outline"}
          size="sm"
          onClick={() => setMode("signup")}
          className="flex-1"
        >
          新規登録
        </Button>
      </div>

      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm font-medium text-zinc-700">
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-zinc-900"
            placeholder="you@example.com"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-zinc-900"
            placeholder="••••••••"
          />
        </label>
        <Button
          type="submit"
          variant="primary"
          disabled={loading || !canUseSupabaseAuth}
          className="w-full"
        >
          {loading ? "送信中..." : mode === "signin" ? "ログイン" : "登録"}
        </Button>
      </form>

      <div className="space-y-2">
        {canUseSupabaseAuth ? (
          oauthProviders.length > 0 ? (
            <>
              {oauthProviders.map((provider) => (
                <Button
                  key={provider}
                  variant="outline"
                  disabled={loading || disabledOauthProviders.includes(provider)}
                  onClick={() => handleOAuth(provider)}
                  className="w-full"
                >
                  {getOAuthProviderLabel(provider)} で続ける
                </Button>
              ))}
              <p className="text-center text-xs text-zinc-500">
                外部アカウントのログインが使えない場合は、別の方法でログインしてください。
              </p>
            </>
          ) : (
            <p className="text-center text-xs text-zinc-500">
              外部アカウントでのログインは現在利用できません。
            </p>
          )
        ) : (
          <p className="text-center text-xs text-zinc-500">
            現在ログイン機能の準備中です。
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span>Iwate150</span>
        <Link href="/" className="font-semibold text-blue-600 underline">
          ホームへ
        </Link>
      </div>

      <Button
        variant="outline"
        onClick={enableGuest}
        className="w-full"
      >
        ゲストで閲覧
      </Button>

      {user && (
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full"
        >
          ログアウト
        </Button>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}
    </div>
  );
}
