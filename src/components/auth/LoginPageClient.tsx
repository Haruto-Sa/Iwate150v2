"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { Mail, MoveRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/components/auth/SessionProvider";

type ProviderMap = Awaited<ReturnType<typeof getProviders>>;

/**
 * ログインページのクライアント本体。
 *
 * @returns LoginPageClient
 * @example
 * <LoginPageClient />
 */
export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut, status } = useAuthSession();
  const [providers, setProviders] = useState<ProviderMap>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const magicLinkSent = searchParams.get("sent") === "1";

  useEffect(() => {
    getProviders().then((result) => setProviders(result));
  }, []);

  const availableProviders = useMemo(() => {
    if (!providers) return [];
    return Object.values(providers).filter((provider) => provider.id !== "credentials");
  }, [providers]);
  const infoMessage = magicLinkSent
    ? "ログイン用リンクをメールで送信しました。受信ボックスをご確認ください。"
    : message;

  /**
   * OAuth ログインを開始する。
   *
   * @param providerId - provider id
   * @returns Promise<void>
   * @example
   * await handleProviderSignIn("google");
   */
  const handleProviderSignIn = async (providerId: string) => {
    setLoadingProvider(providerId);
    await signIn(providerId, { redirectTo: nextPath });
    setLoadingProvider(null);
  };

  /**
   * メールリンク認証を開始する。
   *
   * @returns Promise<void>
   * @example
   * await handleEmailSignIn();
   */
  const handleEmailSignIn = async () => {
    setLoadingProvider("nodemailer");
    const result = await signIn("nodemailer", {
      email,
      redirect: false,
      redirectTo: nextPath,
    });

    if (result?.error) {
      setMessage("メール送信に失敗しました。時間をおいて再度お試しください。");
    } else {
      router.replace("/login?sent=1");
    }
    setLoadingProvider(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[32px] border border-emerald-900/10 bg-gradient-to-br from-[#0d1f22] via-[#12333b] to-[#1e4950] p-6 text-white shadow-xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100/80">VOJA IWATE</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">
              旅の続きを、あとから残せるログインです。
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-emerald-50/85 sm:text-base">
              地図や検索、スポット詳細、カメラ体験はログインなしでそのまま楽しめます。
              お気に入り保存や、これから増える旅の進捗機能を使いたくなった時だけログインしてください。
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-emerald-50/85">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <Sparkles className="h-4 w-4" />
                Explore first
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <ShieldCheck className="h-4 w-4" />
                Save when you want
              </span>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
            <h2 className="text-lg font-semibold">What you can do after login</h2>
            <ul className="mt-4 space-y-3 text-sm text-emerald-50/85">
              <li>Favorites を保存して、次の旅先候補をまとめる</li>
              <li>将来の Stamps や進捗保存をアカウントに残す</li>
              <li>複数デバイスで同じ旅のメモを引き継ぐ</li>
            </ul>
            <Link
              href="/map"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white underline underline-offset-4"
            >
              まずはログインせずに旅先を探す
              <MoveRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-emerald-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#0f1c1a]">Sign in options</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-900/75">
            使えるログイン方法だけを表示しています。準備されていない方法はこの画面には出ません。
          </p>

          <div className="mt-5 space-y-3">
            {availableProviders
              .filter((provider) => provider.id !== "nodemailer")
              .map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="w-full justify-between"
                  disabled={loadingProvider === provider.id}
                  onClick={() => handleProviderSignIn(provider.id)}
                >
                  <span>{provider.name} で続ける</span>
                  <MoveRight className="h-4 w-4" />
                </Button>
              ))}
            {availableProviders.filter((provider) => provider.id !== "nodemailer").length === 0 && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                現在、外部アカウントのログインは準備中です。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#0f1c1a]">Email magic link</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-900/75">
            パスワードを作らずに、メールのリンクから安全にログインできます。
          </p>

          {providers?.nodemailer ? (
            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-zinc-700">
                メールアドレス
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-1 w-full rounded-2xl border border-emerald-900/10 px-4 py-3 text-sm text-zinc-900"
                  placeholder="you@example.com"
                />
              </label>
              <Button
                onClick={handleEmailSignIn}
                disabled={!email || loadingProvider === "nodemailer"}
                className="w-full justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  メールでログインリンクを受け取る
                </span>
                <MoveRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              現在、メールリンクログインは準備中です。
            </p>
          )}

          {infoMessage && (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {infoMessage}
            </p>
          )}

          {status === "authenticated" && user && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">
                ログイン中: {user.email ?? user.name ?? "Traveler"}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={nextPath}>
                  <Button>旅を続ける</Button>
                </Link>
                <Button variant="outline" onClick={() => signOut()}>
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
