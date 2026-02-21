import type { User } from "@supabase/supabase-js";

export type OAuthProvider = "google" | "github";

const DEFAULT_OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github"];

/**
 * 文字列が OAuth プロバイダ識別子か判定する。
 *
 * @param value - 判定対象
 * @returns OAuthProvider なら true
 * @example
 * if (isOAuthProvider("google")) { ... }
 */
function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "github";
}

/**
 * Supabase Auth が有効化されているか判定する。
 *
 * @returns 環境変数が揃っている場合 true
 * @example
 * if (!isSupabaseAuthConfigured()) {
 *   console.warn("Auth disabled");
 * }
 */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Supabase Auth ユーザーから表示名を生成する。
 *
 * @param user - Supabase Auth ユーザー
 * @returns 表示名
 * @example
 * const name = toDisplayName(user);
 */
export function toDisplayName(user: Pick<User, "email" | "user_metadata">): string {
  const fromMeta = user.user_metadata?.display_name as string | undefined;
  if (fromMeta && fromMeta.trim()) return fromMeta.trim();
  if (user.email) return user.email.split("@")[0] || "User";
  return "User";
}

/**
 * OAuth プロバイダ識別子を人間向け表示名へ変換する。
 *
 * @param provider - OAuth プロバイダ
 * @returns 表示名
 * @example
 * getOAuthProviderLabel("google"); // "Google"
 */
export function getOAuthProviderLabel(provider: OAuthProvider): string {
  return provider === "google" ? "Google" : "GitHub";
}

/**
 * 環境変数から有効な OAuth プロバイダ一覧を解決する。
 *
 * `NEXT_PUBLIC_SUPABASE_OAUTH_PROVIDERS=google,github` 形式を受け付ける。
 * 未設定または不正値のみの場合は既定値（google/github）を返す。
 *
 * @returns OAuth プロバイダ配列
 * @example
 * const providers = getConfiguredOAuthProviders();
 */
export function getConfiguredOAuthProviders(): OAuthProvider[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_OAUTH_PROVIDERS;
  if (!raw) return [...DEFAULT_OAUTH_PROVIDERS];

  const parsed = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(isOAuthProvider);

  if (parsed.length === 0) return [...DEFAULT_OAUTH_PROVIDERS];
  return [...new Set(parsed)];
}

/**
 * Supabase が返す「未有効プロバイダ」エラーか判定する。
 *
 * @param message - エラーメッセージ
 * @returns 未有効プロバイダの可能性が高い場合 true
 * @example
 * if (isUnsupportedOAuthProviderError(error.message)) { ... }
 */
export function isUnsupportedOAuthProviderError(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("Unsupported provider") ||
    message.includes("provider is not enabled")
  );
}

/**
 * Supabase Auth エラーをユーザー向け文字列へ整形する。
 *
 * @param message - エラーメッセージ
 * @param provider - OAuth プロバイダ（任意）
 * @returns 表示メッセージ
 * @example
 * setMessage(normalizeAuthError(error.message));
 */
export function normalizeAuthError(
  message: string | null | undefined,
  provider?: OAuthProvider
): string {
  if (!message) return "認証に失敗しました。";
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (message.includes("Email not confirmed")) {
    return "メール確認が完了していません。受信メールのリンクを開いてください。";
  }
  if (isUnsupportedOAuthProviderError(message)) {
    const providerLabel = provider ? `${getOAuthProviderLabel(provider)} ` : "";
    return `${providerLabel}ログインは現在有効化されていません。Supabase Dashboard の Authentication > Providers で設定してください。`;
  }
  return message;
}
