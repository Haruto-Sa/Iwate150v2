import type { User } from "@supabase/supabase-js";

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
 * Supabase Auth エラーをユーザー向け文字列へ整形する。
 *
 * @param message - エラーメッセージ
 * @returns 表示メッセージ
 * @example
 * setMessage(normalizeAuthError(error.message));
 */
export function normalizeAuthError(message: string | null | undefined): string {
  if (!message) return "認証に失敗しました。";
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (message.includes("Email not confirmed")) {
    return "メール確認が完了していません。受信メールのリンクを開いてください。";
  }
  return message;
}
