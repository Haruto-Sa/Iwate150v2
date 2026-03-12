import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import type { Provider } from "next-auth/providers";
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
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  if (
    process.env.AUTH_EMAIL_SERVER_HOST &&
    process.env.AUTH_EMAIL_SERVER_PORT &&
    process.env.AUTH_EMAIL_FROM
  ) {
    providers.push(
      Nodemailer({
        server: {
          host: process.env.AUTH_EMAIL_SERVER_HOST,
          port: Number(process.env.AUTH_EMAIL_SERVER_PORT),
          secure: process.env.AUTH_EMAIL_SERVER_SECURE === "true",
          auth:
            process.env.AUTH_EMAIL_SERVER_USER && process.env.AUTH_EMAIL_SERVER_PASSWORD
              ? {
                  user: process.env.AUTH_EMAIL_SERVER_USER,
                  pass: process.env.AUTH_EMAIL_SERVER_PASSWORD,
                }
              : undefined,
        },
        from: process.env.AUTH_EMAIL_FROM,
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
     * 認証トークンへ表示名とロールを埋め込む。
     *
     * @param params - NextAuth callback params
     * @returns 更新後 token
     * @example
     * await callbacks.jwt(params);
     */
    async jwt({ token, user }) {
      const identityId = typeof token.sub === "string" ? token.sub : typeof user?.id === "string" ? user.id : null;
      if (!identityId) return token;

      const appUser = await syncAppUserFromIdentity({
        identityId,
        email: user?.email ?? token.email ?? null,
        name: user?.name ?? token.name ?? null,
      });

      token.role = appUser?.role ?? "user";
      token.displayName = appUser?.display_name ?? user?.name ?? token.name ?? "Traveler";
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
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : "";
        session.user.role =
          token.role === "admin" || token.role === "super_admin" || token.role === "user"
            ? token.role
            : "user";
        session.user.name = typeof token.displayName === "string" ? token.displayName : session.user.name;
      }
      return session;
    },
  },
});
