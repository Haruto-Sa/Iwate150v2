import { NextResponse } from "next/server";
import { createSpot } from "@/lib/adminServer";
import { buildStudioErrorResponse, readJsonObject, requireStudioApiAccess } from "@/lib/studioApi";
import { parseSpotCreateInput } from "@/lib/studioPayloads";

/**
 * Studio からスポットを作成する。
 *
 * @param request - Next.js request
 * @returns 作成結果
 * @example
 * await POST(request);
 */
export async function POST(request: Request): Promise<NextResponse> {
  const access = await requireStudioApiAccess();
  if (access.response) {
    return access.response;
  }

  try {
    const body = await readJsonObject(request);
    const input = parseSpotCreateInput(body);
    const spot = await createSpot(input);
    return NextResponse.json(spot, { status: 201 });
  } catch (error) {
    return buildStudioErrorResponse(error, "Failed to create spot.");
  }
}
