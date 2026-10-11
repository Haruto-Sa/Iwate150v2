import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { oauthIdentity } from "@/lib/oauthIdentity";
import { syncAppUserFromIdentity } from "@/lib/authServer";

/**
 * 利用可能な認証プロバイダを構築する。
 *
 * @returns NextAuth providers
 * @example
 * const providers = buildProviders();
 */
function buildProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        allowDangerousEmailAccountLinking: false,
      })
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        allowDangerousEmailAccountLinking: false,
      })
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?sent=1",
  },
  providers: buildProviders(),
  callbacks: {
    /**
     * 認証トークンからプロフィールを除き、本人識別子とロールを設定する。
     *
     * @param params - NextAuth callback params
     * @returns 更新後 token
     * @example
     * await callbacks.jwt(params);
     */
    async jwt({ token, user, account }) {
      // 既存Cookieも更新時にプロフィールを取り除く。
      delete token.email;
      delete token.name;
      delete token.picture;
      delete token.displayName;
      // 検証済みOAuth callbackでのみIDを確定。クライアントのsession updateは信用しない。
      if (account && (account.provider === "google" || account.provider === "github")) {
        token.sub = oauthIdentity(account.provider, account.providerAccountId);
      }
      const identityId = typeof token.sub === "string" ? token.sub : typeof user?.id === "string" ? user.id : null;
      if (!identityId) return token;

      const appUser = await syncAppUserFromIdentity({
        identityId,
      });

      token.role = appUser?.role ?? "user";
      return token;
    },
    /**
     * クライアントへ返す session を整形する。
     *
     * @param params - NextAuth callback params
     * @returns session
     * @example
     * await callbacks.session(params);
     */
    async session({ session, token }) {
      return {
        expires: session.expires,
        user: {
          id: typeof token.sub === "string" ? token.sub : "",
          role: token.role === "admin" || token.role === "super_admin" ? token.role : "user",
        },
      };
    },
  },
});
