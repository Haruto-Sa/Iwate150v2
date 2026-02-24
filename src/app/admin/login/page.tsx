"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { fetchCurrentAppUser, getSupabaseClient } from "@/lib/supabaseClient";
import { normalizeAuthError } from "@/lib/auth";

/**
 * 管理者専用ログイン画面。
 *
 * メール+パスワード認証のみを許可し、ログイン成功後に
 * `/api/admin/bootstrap` を呼んで初期管理者付与を試行する。
 *
 * @returns AdminLoginPage コンポーネント
 * @example
 * <AdminLoginPage />
 */
export default function AdminLoginPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const { status, signOut, refreshSession } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchCurrentAppUser()
      .then((user) => {
        if (user?.role === "admin" || user?.role === "super_admin") {
          router.replace("/admin");
        }
      })
      .catch(() => {
        // 権限確認失敗時は画面に留め、手動ログイン再実行を許可する。
      });
  }, [router, status]);

  /**
   * 管理者ログインフォームを送信する。
   *
   * @param event - フォームイベント
   * @returns Promise<void>
   * @example
   * <form onSubmit={handleSubmit}>...</form>
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("Supabase 未設定のため管理者ログインを利用できません。");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(normalizeAuthError(error.message));
      setLoading(false);
      return;
    }

    await refreshSession();
    const accessToken =
      data.session?.access_token ??
      (await supabase.auth.getSession()).data.session?.access_token ??
      null;

    if (!accessToken) {
      await signOut();
      setMessage("セッション取得に失敗しました。再度ログインしてください。");
      setLoading(false);
      return;
    }

    const bootstrapResponse = await fetch("/api/admin/bootstrap", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!bootstrapResponse.ok) {
      await signOut();
      const payload = (await bootstrapResponse.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error ?? "管理者初期化に失敗しました。");
      setLoading(false);
      return;
    }

    const currentUser = await fetchCurrentAppUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
      await signOut();
      setMessage("このアカウントには管理者権限がありません。");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace("/admin");
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-200/70 bg-white/95 p-6 shadow-lg">
      <div className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Iwate150 Admin</p>
        <h1 className="text-2xl font-bold text-zinc-900">管理者ログイン</h1>
        <p className="text-sm text-zinc-600">管理ポータルはメールアドレス認証のみ対応しています。</p>
      </div>

      <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-zinc-700">
          メールアドレス
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            placeholder="admin@example.com"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          パスワード
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            placeholder="••••••••"
          />
        </label>
        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? "認証中..." : "管理者としてログイン"}
        </Button>
      </form>

      {message && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {message}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between text-xs text-zinc-600">
        <Link href="/" className="underline underline-offset-2">
          ホームへ戻る
        </Link>
        <Link href="/login" className="underline underline-offset-2">
          一般ログイン
        </Link>
      </div>
    </div>
  );
}
