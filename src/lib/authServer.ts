import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User, UserRole } from "@/lib/types";

type IdentityPayload = {
  identityId: string;
  email?: string | null;
  name?: string | null;
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
 * 管理者ブートストラップ対象メール一覧を取得する。
 *
 * @returns 小文字化済みメール集合
 * @example
 * getBootstrapEmails().has("admin@example.com");
 */
export function getBootstrapEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * 表示名の既定値を返す。
 *
 * @param payload - identity 情報
 * @returns 表示名
 * @example
 * deriveDisplayName({ identityId: "1", email: "test@example.com" });
 */
export function deriveDisplayName(payload: IdentityPayload): string {
  if (payload.name?.trim()) return payload.name.trim();
  if (payload.email?.trim()) return payload.email.split("@")[0] || "Traveler";
  return "Traveler";
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
    console.warn("[auth] app user lookup failed", error.message);
    return null;
  }
  return (data as User | null) ?? null;
}

/**
 * 認証ユーザーを `public.users` と同期する。
 *
 * @param payload - identity 情報
 * @returns 同期後ユーザー。Supabase 未設定時は仮ユーザー
 * @example
 * await syncAppUserFromIdentity({ identityId: "user_123", email: "test@example.com" });
 */
export async function syncAppUserFromIdentity(payload: IdentityPayload): Promise<User | null> {
  const normalizedEmail = payload.email?.trim().toLowerCase() ?? null;
  const nextRole: UserRole =
    normalizedEmail && getBootstrapEmails().has(normalizedEmail) ? "super_admin" : "user";
  const existing = await fetchAppUserByIdentity(payload.identityId);

  if (!getServerAdminClient()) {
    return existing ?? {
      id: 0,
      auth_id: payload.identityId,
      email: normalizedEmail,
      role: nextRole,
      display_name: deriveDisplayName(payload),
      created_at: new Date().toISOString(),
    };
  }

  const client = getServerAdminClient();
  if (!client) return existing;

  if (existing) {
    const desiredRole = existing.role === "admin" || existing.role === "super_admin" ? existing.role : nextRole;
    const { data, error } = await client
      .from("users")
      .update({
        email: normalizedEmail,
        display_name: deriveDisplayName(payload),
        role: desiredRole,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      console.warn("[auth] app user update failed", error.message);
      return existing;
    }
    return data as User;
  }

  const { data, error } = await client
    .from("users")
    .insert({
      auth_id: payload.identityId,
      email: normalizedEmail,
      display_name: deriveDisplayName(payload),
      role: nextRole,
    })
    .select("*")
    .single();

  if (error) {
    console.warn("[auth] app user insert failed", error.message);
    return null;
  }
  return data as User;
}
