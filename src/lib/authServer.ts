import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User, UserRole } from "@/lib/types";

type IdentityPayload = {
  identityId: string;
};

let adminClient: SupabaseClient | null | undefined;

/**
 * service_role 用の Supabase クライアントを返す。
 *
 * @returns Supabase client。環境変数不足時は null
 * @example
 * const client = getServerAdminClient();
 */
export function getServerAdminClient(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    adminClient = null;
    return adminClient;
  }

  adminClient = createClient(url, serviceRoleKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}

/**
 * 値が有効なロールか判定する。
 *
 * @param value - 判定対象
 * @returns true の場合は UserRole
 * @example
 * isUserRole("admin");
 */
export function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "admin" || value === "super_admin";
}

/**
 * identity ID で公開ユーザーを取得する。
 *
 * @param identityId - 認証 ID
 * @returns ユーザー。取得不可時は null
 * @example
 * await fetchAppUserByIdentity("user_123");
 */
export async function fetchAppUserByIdentity(identityId: string): Promise<User | null> {
  const client = getServerAdminClient();
  if (!client) return null;

  const { data, error } = await client.from("users").select("*").eq("auth_id", identityId).maybeSingle();
  if (error) {
    console.warn("[auth] app user lookup failed");
    return null;
  }
  return (data as User | null) ?? null;
}

/**
 * 認証ユーザーを `public.users` と同期する。
 * プロフィール削除済みの既存行は書き込まず、読み取った現在の権限を返す。
 *
 * @param payload - identity 情報
 * @returns 同期後ユーザー。Supabase 未設定・失敗時は null
 * @example
 * await syncAppUserFromIdentity({ identityId: "user_123" });
 */
export async function syncAppUserFromIdentity(payload: IdentityPayload): Promise<User | null> {
  const existing = await fetchAppUserByIdentity(payload.identityId);

  if (!getServerAdminClient()) return null;

  const client = getServerAdminClient();
  if (!client) return existing;

  if (existing) {
    if (existing.email === null && existing.display_name === "Traveler") return existing;

    const { data, error } = await client
      .from("users")
      .update({
        email: null,
        display_name: "Traveler",
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      console.warn("[auth] app user update failed");
      return existing;
    }
    return data as User;
  }

  const { data, error } = await client
    .from("users")
    .insert({
      auth_id: payload.identityId,
      email: null,
      display_name: "Traveler",
      role: "user",
    })
    .select("*")
    .single();

  if (error) {
    // 同時の初回ログインではUNIQUE制約の勝者が作った行を再取得する。
    if (error.code === "23505") return fetchAppUserByIdentity(payload.identityId);
    console.warn("[auth] app user insert failed");
    return null;
  }
  return data as User;
}
