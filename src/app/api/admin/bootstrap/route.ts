import { NextResponse } from "next/server";

/**
 * 旧管理 API は廃止済み。
 *
 * @returns 410 response
 * @example
 * await POST();
 */
export async function POST(): Promise<NextResponse<{ error: string }>> {
  return NextResponse.json(
    { error: "This endpoint has been retired. Use the private studio workspace." },
    { status: 410 }
  );
}
