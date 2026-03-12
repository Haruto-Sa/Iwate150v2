import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { FAVORITES_PATH, PUBLIC_LOGIN_PATH, SECRET_WORKSPACE_PATH } from "@/lib/config";

/**
 * 保護対象ルートへ未認証で来た場合にログインページへ送る middleware。
 *
 * @param request - 認証付き request
 * @returns NextResponse
 * @example
 * export default auth((request) => { ... });
 */
export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith(SECRET_WORKSPACE_PATH) || pathname.startsWith(FAVORITES_PATH);

  if (!isProtected) {
    return NextResponse.next();
  }

  if (request.auth?.user) {
    return NextResponse.next();
  }

  const loginUrl = new URL(PUBLIC_LOGIN_PATH, request.nextUrl.origin);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/studio/:path*", "/favorites/:path*"],
};
