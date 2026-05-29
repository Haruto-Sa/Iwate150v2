import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * ミドルウェア。
 *
 * Studio 配下の認証は各ページ・レイアウトで個別に処理するため、
 * ここでは何もせずそのまま通す。
 *
 * @param _request - リクエスト
 * @returns NextResponse
 */
export default function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
