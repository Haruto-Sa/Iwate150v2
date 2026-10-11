/**
 * OAuthの不変識別子を既存users.auth_id用の衝突しないキーに変換する。
 * @param provider - 認証済みプロバイダ
 * @param accountId - プロバイダの不変アカウントID
 * @returns 永続的なidentityキー
 * @example oauthIdentity("google", "123");
 */
export function oauthIdentity(provider: "google" | "github", accountId: string): string {
  if (!accountId) throw new Error("OAuth account ID is required.");
  return `oauth:${provider}:${encodeURIComponent(accountId)}`;
}
