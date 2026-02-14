"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Supabase Auth セッションを監視してアプリ全体に共有する Provider。
 *
 * @param props.children - 子要素
 * @returns SessionProvider コンポーネント
 * @example
 * <SessionProvider><App /></SessionProvider>
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  /**
   * 現在セッションを再取得して状態へ反映する。
   *
   * @returns Promise<void>
   * @example
   * await refreshSession();
   */
  const refreshSession = useCallback(async () => {
    if (!supabase) {
      setSession(null);
      setStatus("unauthenticated");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const nextSession = data.session ?? null;
    setSession(nextSession);
    setStatus(nextSession ? "authenticated" : "unauthenticated");
  }, [supabase]);

  /**
   * Supabase Auth セッションを破棄する。
   *
   * @returns Promise<void>
   * @example
   * await signOut();
   */
  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setStatus("unauthenticated");
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    if (!supabase) {
      setSession(null);
      setStatus("unauthenticated");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const initialSession = data.session ?? null;
      setSession(initialSession);
      setStatus(initialSession ? "authenticated" : "unauthenticated");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      status,
      refreshSession,
      signOut,
    }),
    [refreshSession, session, signOut, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Supabase Auth の共有状態を取得するカスタムフック。
 *
 * @returns 認証状態コンテキスト
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
