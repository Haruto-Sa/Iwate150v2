import { handlePrivateRecords } from "@/lib/privateUserApi";

export const dynamic = "force-dynamic";

/**
 * 本人のstampsをGETで操作する。
 * @param request - HTTP request
 * @returns 本人限定の結果
 * @example await GET(request);
 */
export async function GET(request: Request) {
  return handlePrivateRecords(request, "stamps");
}

/**
 * 本人のstampsをPOSTで操作する。
 * @param request - HTTP request
 * @returns 本人限定の結果
 * @example await POST(request);
 */
export async function POST(request: Request) {
  return handlePrivateRecords(request, "stamps");
}

