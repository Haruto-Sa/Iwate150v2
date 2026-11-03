import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getServerAdminClient } from "@/lib/authServer";
import { ApiError, assertSameOrigin, readLimitedJson } from "@/lib/apiGuards";

export const MAX_MERGE_ITEMS = 100;
const PAGE_SIZE = 100;

/**
 * キャッシュ禁止のJSON応答を作る。
 * @param body - レスポンス
 * @param status - HTTP status
 * @returns JSON response
 * @example privateJson({ items: [] });
 */
export function privateJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}

/**
 * スポットIDを検証する。
 * @param value - 入力値
 * @returns 正の整数
 * @example spotId(12);
 */
function spotId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new ApiError(400, "スポットIDが不正です。");
  }
  return value;
}

/**
 * セッションから所有者を決定し、本人の記録だけを読み書きする。
 * @param request - HTTP request
 * @param table - 許可された個人テーブル
 * @returns キャッシュ禁止の応答
 * @example handlePrivateRecords(request, "favorites");
 */
export async function handlePrivateRecords(request: Request, table: "favorites" | "stamps"): Promise<NextResponse> {
  try {
    const session = await auth();
    const identity = session?.user?.id;
    if (!identity) throw new ApiError(401, "ログインが必要です。");
    // リクエスト開始後にCookieの利用者が変わった場合も旧画面の操作を適用しない。
    const expectedIdentity = request.headers.get("x-session-user");
    if (expectedIdentity && expectedIdentity !== identity) throw new ApiError(409, "利用者が変更されました。再読み込みしてください。");
    if (request.method !== "GET") {
      assertSameOrigin(request);
    }
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some((key) => key !== "offset")) throw new ApiError(400, "検索条件が不正です。");
    const client = getServerAdminClient();
    if (!client) throw new ApiError(503, "保存サービスを利用できません。");
    const { data: owner, error: ownerError } = await client.from("users").select("id").eq("auth_id", identity).maybeSingle();
    if (ownerError || !owner || !Number.isSafeInteger(owner.id) || owner.id <= 0) throw new ApiError(503, "利用者情報を確認できません。");

    if (request.method === "GET") {
      const rawOffset = url.searchParams.get("offset") ?? "0";
      const offset = Number(rawOffset);
      if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 100_000) throw new ApiError(400, "ページが不正です。");
      const { data, error } = await client.from(table).select("id,user_id,spot_id,created_at")
        .eq("user_id", owner.id).order("id", { ascending: false }).range(offset, offset + PAGE_SIZE);
      if (error) throw new ApiError(503, "一覧を取得できません。");
      const rows = data ?? [];
      return privateJson({ items: rows.slice(0, PAGE_SIZE), nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null });
    }
    const body = await readLimitedJson(request, request.method === "POST" && table === "favorites" ? ["spotIds"] : ["spotId"]);
    if (request.method === "DELETE" && table === "favorites") {
      const id = spotId(body.spotId);
      const { error } = await client.from(table).delete().eq("user_id", owner.id).eq("spot_id", id);
      if (error) throw new ApiError(503, "削除できませんでした。");
      return privateJson({ success: true });
    }
    let ids: number[];
    if (table === "favorites" && request.method === "POST") {
      if (!Array.isArray(body.spotIds) || !body.spotIds.length || body.spotIds.length > MAX_MERGE_ITEMS) throw new ApiError(400, "1〜100件を指定してください。");
      ids = [...new Set(body.spotIds.map(spotId))];
    } else { ids = [spotId(body.spotId)]; }
    // 一つのINSERTでcommitする。失敗時は保存済みIDを返さない。
    const { error } = await client.from(table).upsert(ids.map((id) => ({ user_id: owner.id, spot_id: id })),
      { onConflict: "user_id,spot_id", ignoreDuplicates: true });
    if (error) throw new ApiError(error.code === "23503" ? 404 : 503, "保存できませんでした。");
    const { data, error: readError } = await client.from(table).select("id,user_id,spot_id,created_at")
      .eq("user_id", owner.id).in("spot_id", ids);
    if (readError) throw new ApiError(503, "保存結果を確認できません。再試行してください。");
    return privateJson({ items: data ?? [], persistedSpotIds: (data ?? []).map((row) => row.spot_id) });
  } catch (error) {
    return privateJson({ error: error instanceof ApiError ? error.message : "保存サービスを利用できません。" }, error instanceof ApiError ? error.status : 503);
  }
}
