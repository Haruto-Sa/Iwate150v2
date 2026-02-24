import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

type BootstrapResponse = {
  role: UserRole;
  isBootstrapApplied: boolean;
};

/**
 * 値がユーザーロールか判定する。
 *
 * @param value - 判定対象
 * @returns UserRole の場合 true
 * @example
 * isUserRole("super_admin");
 */
function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "admin" || value === "super_admin";
}

/**
 * `Authorization: Bearer ...` からアクセストークンを抽出する。
 *
 * @param request - API リクエスト
 * @returns トークン。形式不正時は null
 * @example
 * const token = getBearerToken(request);
 */
function getBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * 環境変数 `ADMIN_BOOTSTRAP_EMAILS` を正規化して集合化する。
 *
 * @returns 小文字化済みメールアドレスの Set
 * @example
 * const emails = getBootstrapEmails();
 */
function getBootstrapEmails(): Set<string> {
  const raw = process.env.ADMIN_BOOTSTRAP_EMAILS ?? "";
  const normalized = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return new Set(normalized);
}

/**
 * メールアドレスから表示名の既定値を作成する。
 *
 * @param email - メールアドレス
 * @returns 表示名
 * @example
 * const name = deriveDisplayName("admin@example.com");
 */
function deriveDisplayName(email: string | null | undefined): string {
  if (!email) return "User";
  const local = email.split("@")[0];
  return local || "User";
}

/**
 * 管理者ブートストラップ API。
 *
 * - Bearer トークンでユーザー本人確認
 * - `public.users` 未作成時は作成
 * - `ADMIN_BOOTSTRAP_EMAILS` 対象なら `super_admin` へ昇格
 *
 * @param request - Next.js request
 * @returns 現在ロールと bootstrap 適用結果
 * @example
 * POST /api/admin/bootstrap
 */
export async function POST(request: NextRequest): Promise<NextResponse<BootstrapResponse | { error: string }>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "サーバー環境変数が不足しています。" },
      { status: 500 }
    );
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "認証トークンが必要です。" }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: authUser },
    error: authError,
  } = await adminClient.auth.getUser(accessToken);
  if (authError || !authUser) {
    return NextResponse.json({ error: "トークン検証に失敗しました。" }, { status: 401 });
  }

  const normalizedEmail = authUser.email?.trim().toLowerCase() ?? null;
  const displayName = deriveDisplayName(authUser.email);

  const { data: existingProfile, error: existingError } = await adminClient
    .from("users")
    .select("id,auth_id,email,display_name,role,created_at")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: "プロフィール参照に失敗しました。" }, { status: 500 });
  }

  let profile = existingProfile;
  if (!profile) {
    const { data: insertedProfile, error: insertError } = await adminClient
      .from("users")
      .insert({
        auth_id: authUser.id,
        email: normalizedEmail,
        display_name: displayName,
        role: "user",
      })
      .select("id,auth_id,email,display_name,role,created_at")
      .single();

    if (insertError || !insertedProfile) {
      return NextResponse.json({ error: "プロフィール作成に失敗しました。" }, { status: 500 });
    }
    profile = insertedProfile;
  }

  if (!profile.email && normalizedEmail) {
    const { data: updatedEmailProfile, error: emailUpdateError } = await adminClient
      .from("users")
      .update({ email: normalizedEmail })
      .eq("id", profile.id)
      .select("id,auth_id,email,display_name,role,created_at")
      .single();
    if (!emailUpdateError && updatedEmailProfile) {
      profile = updatedEmailProfile;
    }
  }

  const currentRole: UserRole = isUserRole(profile.role) ? profile.role : "user";
  const bootstrapEmails = getBootstrapEmails();
  const shouldBootstrap = normalizedEmail ? bootstrapEmails.has(normalizedEmail) : false;

  if (shouldBootstrap && currentRole !== "super_admin") {
    const { data: updatedRoleProfile, error: roleUpdateError } = await adminClient
      .from("users")
      .update({ role: "super_admin" })
      .eq("id", profile.id)
      .select("role")
      .single();
    if (roleUpdateError || !updatedRoleProfile || !isUserRole(updatedRoleProfile.role)) {
      return NextResponse.json({ error: "管理者権限の初期化に失敗しました。" }, { status: 500 });
    }
    return NextResponse.json({
      role: updatedRoleProfile.role,
      isBootstrapApplied: true,
    });
  }

  return NextResponse.json({
    role: currentRole,
    isBootstrapApplied: false,
  });
}
