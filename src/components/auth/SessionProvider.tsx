"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  SessionProvider as NextAuthSessionProvider,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
  useSession,
} from "next-auth/react";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthUser = {
  id: string;
  email: string | null | undefined;
  name: string | null | undefined;
  role: "user" | "admin" | "super_admin";
};

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  signIn: typeof nextAuthSignIn;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 認証状態をアプリ全体へ共有する Provider。
 *
 * @param props.children - 子要素
 * @returns Provider
 * @example
 * <SessionProvider><App /></SessionProvider>
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider refetchOnWindowFocus={false}>
      <AuthSessionBridge>{children}</AuthSessionBridge>
    </NextAuthSessionProvider>
  );
}

/**
 * NextAuth の session を既存 hook 互換形へ橋渡しする。
 *
 * @param props.children - 子要素
 * @returns Provider
 * @example
 * <AuthSessionBridge>{children}</AuthSessionBridge>
 */
function AuthSessionBridge({ children }: { children: ReactNode }) {
  const { data, status, update } = useSession();

  const user = data?.user
    ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
      }
    : null;
  const value: AuthContextValue = {
    user,
    status,
    refreshSession: async () => {
      await update();
    },
    signOut: async () => {
      await nextAuthSignOut({ redirect: false });
      await update();
    },
    signIn: nextAuthSignIn,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * アプリ共通の認証状態を返す。
 *
 * @returns 認証コンテキスト
 * @example
 * const { user, status } = useAuthSession();
 */
export function useAuthSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthSession must be used within SessionProvider");
  }
  return context;
}
