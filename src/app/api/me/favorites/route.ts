import { handlePrivateRecords } from "@/lib/privateUserApi";

export const dynamic = "force-dynamic";

/**
 * 本人のfavoritesをGETで操作する。
 * @param request - HTTP request
 * @returns 本人限定の結果
 * @example await GET(request);
 */
export async function GET(request: Request) {
  return handlePrivateRecords(request, "favorites");
}

/**
 * 本人のfavoritesをPOSTで操作する。
 * @param request - HTTP request
 * @returns 本人限定の結果
 * @example await POST(request);
 */
export async function POST(request: Request) {
  return handlePrivateRecords(request, "favorites");
}

/**
 * 本人のfavoritesをPUTで操作する。
 * @param request - HTTP request
 * @returns 本人限定の結果
 * @example await PUT(request);
 */
export async function PUT(request: Request) {
  return handlePrivateRecords(request, "favorites");
}

/**
 * 本人のfavoritesをDELETEで操作する。
 * @param request - HTTP request
 * @returns 本人限定の結果
 * @example await DELETE(request);
 */
export async function DELETE(request: Request) {
  return handlePrivateRecords(request, "favorites");
}

