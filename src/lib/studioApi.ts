import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AdminServerConfigError, AdminServerNotFoundError } from "@/lib/adminServer";
import { fetchAppUserByIdentity } from "@/lib/authServer";
import type { User } from "@/lib/types";

type StudioAccessResult =
  | {
      currentUser: User;
      response?: never;
    }
  | {
      currentUser?: never;
      response: NextResponse<{ error: string }>;
    };

/**
 * Studio API 向けに管理者権限を検証する。
 *
 * @returns 管理者ユーザー、またはエラーレスポンス
 * @example
 * const access = await requireStudioApiAccess();
 */
export async function requireStudioApiAccess(): Promise<StudioAccessResult> {
  const session = await auth();
  const identityId = session?.user?.id;
  if (!identityId) {
    return {
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const currentUser = await fetchAppUserByIdentity(identityId);
  if (!currentUser) {
    return {
      response: NextResponse.json({ error: "Profile not found." }, { status: 403 }),
    };
  }

  if (currentUser.role !== "admin" && currentUser.role !== "super_admin") {
    return {
      response: NextResponse.json({ error: "Admin privileges required." }, { status: 403 }),
    };
  }

  return { currentUser };
}

/**
 * 値を整数 ID として検証する。
 *
 * @param value - 入力値
 * @param fieldName - フィールド名
 * @returns 整数 ID
 * @throws Error 不正値
 * @example
 * parseRequiredInteger("12", "city_id");
 */
export function parseRequiredInteger(value: unknown, fieldName: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

/**
 * 値を省略可能な整数 ID として検証する。
 *
 * @param value - 入力値
 * @param fieldName - フィールド名
 * @returns 整数 ID または null
 * @throws Error 不正値
 * @example
 * parseOptionalInteger(null, "city_id");
 */
export function parseOptionalInteger(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  return parseRequiredInteger(value, fieldName);
}

/**
 * 値を浮動小数点数として検証する。
 *
 * @param value - 入力値
 * @param fieldName - フィールド名
 * @returns 数値
 * @throws Error 不正値
 * @example
 * parseRequiredNumber("39.7", "lat");
 */
export function parseRequiredNumber(value: unknown, fieldName: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  return parsed;
}

/**
 * 必須文字列を検証して返す。
 *
 * @param value - 入力値
 * @param fieldName - フィールド名
 * @returns trim 済み文字列
 * @throws Error 不正値
 * @example
 * parseRequiredString(" 盛岡 ", "name");
 */
export function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

/**
 * 省略可能文字列を検証して返す。
 *
 * @param value - 入力値
 * @returns trim 済み文字列または null
 * @throws Error 不正値
 * @example
 * parseOptionalString("  ", true);
 */
export function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Optional string field must be a string.");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * 省略可能日付文字列を検証して返す。
 *
 * @param value - 入力値
 * @param fieldName - フィールド名
 * @returns 日付文字列または null
 * @throws Error 不正値
 * @example
 * parseOptionalDate("2026-03-12", "start_date");
 */
export function parseOptionalDate(value: unknown, fieldName: string): string | null {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format.`);
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${fieldName} must be a valid date.`);
  }
  return normalized;
}

/**
 * JSON ボディをオブジェクトとして読み込む。
 *
 * @param request - Next.js request
 * @returns JSON object
 * @throws Error JSON object でない場合
 * @example
 * const body = await readJsonObject(request);
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const payload = await request.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }
  return payload as Record<string, unknown>;
}

/**
 * Studio API の例外をレスポンスへ変換する。
 *
 * @param error - 捕捉した例外
 * @param fallbackMessage - 既定メッセージ
 * @returns JSON error response
 * @example
 * return buildStudioErrorResponse(error, "Failed to save.");
 */
export function buildStudioErrorResponse(error: unknown, fallbackMessage: string): NextResponse<{ error: string }> {
  if (error instanceof AdminServerNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof AdminServerConfigError) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
