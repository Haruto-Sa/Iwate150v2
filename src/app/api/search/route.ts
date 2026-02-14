import { NextRequest, NextResponse } from "next/server";
import { searchEvents, searchSpots } from "@/lib/supabaseClient";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_KEYWORD_LENGTH = 100;

/**
 * 文字列を正の整数として安全に解析する。
 *
 * @param value - 入力文字列
 * @returns 正の整数。無効値は null
 * @example
 * const page = parsePositiveInteger("2");
 */
function parsePositiveInteger(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const safe = Math.floor(num);
  return safe > 0 ? safe : null;
}

/**
 * キーワードを正規化する。
 *
 * @param raw - 生キーワード
 * @returns 正規化済みキーワード
 * @example
 * const keyword = normalizeKeyword("  盛岡  ");
 */
function normalizeKeyword(raw: string | null): string {
  if (!raw) return "";
  return raw.trim().slice(0, MAX_KEYWORD_LENGTH);
}

/**
 * 検索 API (GET)
 *
 * - tab=spot: 市区町村+ジャンル+キーワード
 * - tab=event: 市区町村+キーワード
 *
 * @param request - Next.js request
 * @returns ページング結果 JSON
 * @example
 * GET /api/search?tab=spot&page=1&pageSize=50
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const tab = searchParams.get("tab");
  const page = parsePositiveInteger(searchParams.get("page")) ?? 1;
  const rawPageSize = parsePositiveInteger(searchParams.get("pageSize")) ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));
  const cityId = parsePositiveInteger(searchParams.get("cityId"));
  const genreId = parsePositiveInteger(searchParams.get("genreId"));
  const keyword = normalizeKeyword(searchParams.get("keyword"));

  if (tab !== "spot" && tab !== "event") {
    return NextResponse.json(
      { error: "tab must be either 'spot' or 'event'" },
      { status: 400 }
    );
  }

  if (tab === "event" && genreId !== null) {
    return NextResponse.json(
      { error: "genre filter is not supported for events" },
      { status: 400 }
    );
  }

  try {
    if (tab === "spot") {
      const result = await searchSpots({
        keyword,
        cityId,
        genreId,
        page,
        pageSize,
      });
      return NextResponse.json(result);
    }

    const result = await searchEvents({
      keyword,
      cityId,
      page,
      pageSize,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/search] unexpected error", error);
    return NextResponse.json(
      { error: "failed to execute search" },
      { status: 500 }
    );
  }
}
