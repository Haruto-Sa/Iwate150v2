"use client";

import { PageHeading } from "@/components/ui/PageHeading";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { Mail, MoveRight } from "lucide-react";
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
      <PageHeading title="ログイン" actions={<Link href="/map" className="action-link action-link-secondary">ログインせずに旅先を探す</Link>} />

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-app-line/10 bg-app-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-app-ink-strong">アカウントでログイン</h2>

          <div className="mt-5 space-y-3">
            {providers === null ? (
              <p className="rounded-2xl border border-app-line-soft bg-app-surface-soft px-4 py-3 text-sm text-app-ink">
                ログイン方法を確認中です...
              </p>
            ) : (
              availableProviders
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
                ))
            )}
            {providers !== null && availableProviders.filter((provider) => provider.id !== "nodemailer").length === 0 && (
              <p className="rounded-2xl border border-app-warning/30 bg-app-warning-surface px-4 py-3 text-sm text-app-warning">
                アカウントでのログインは現在利用できません。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-app-line/10 bg-app-surface p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-app-ink-strong">メールでログイン</h2>

          {providers === null ? (
            <p className="mt-5 rounded-2xl border border-app-line-soft bg-app-surface-soft px-4 py-3 text-sm text-app-ink">
              メールログイン設定を確認中です...
            </p>
          ) : providers?.nodemailer ? (
            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-app-ink-muted">
                メールアドレス
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-1 w-full rounded-2xl border border-app-line/10 px-4 py-3 text-sm text-app-ink-strong"
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
                  ログインリンクを受け取る
                </span>
                <MoveRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-app-warning/30 bg-app-warning-surface px-4 py-3 text-sm text-app-warning">
              メールでのログインは現在利用できません。
            </p>
          )}

          {infoMessage && (
            <p className="mt-4 rounded-2xl border border-app-line-soft bg-app-surface-soft px-4 py-3 text-sm text-app-ink">
              {infoMessage}
            </p>
          )}

          {status === "authenticated" && user && (
            <div className="mt-5 rounded-2xl border border-app-line-soft bg-app-surface-soft p-4">
              <p className="text-sm text-app-ink">
                ログイン中: {user.email ?? user.name ?? "Traveler"}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={nextPath} className="action-link">旅を続ける</Link>
                <Button variant="outline" onClick={() => signOut()}>
                  ログアウト
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
