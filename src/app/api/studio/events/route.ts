import { NextResponse } from "next/server";
import { createEvent } from "@/lib/adminServer";
import { buildStudioErrorResponse, readJsonObject, requireStudioApiAccess } from "@/lib/studioApi";
import { parseEventCreateInput } from "@/lib/studioPayloads";

/**
 * Studio からイベントを作成する。
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
    const input = parseEventCreateInput(body);
    const event = await createEvent(input);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return buildStudioErrorResponse(error, "Failed to create event.");
  }
}
