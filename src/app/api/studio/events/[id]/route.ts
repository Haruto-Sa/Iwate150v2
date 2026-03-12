import { NextResponse } from "next/server";
import { deleteEvent, fetchAdminEventById, updateEvent } from "@/lib/adminServer";
import { buildStudioErrorResponse, parseRequiredInteger, readJsonObject, requireStudioApiAccess } from "@/lib/studioApi";
import { parseEventUpdateInput } from "@/lib/studioPayloads";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Studio からイベントを更新する。
 *
 * @param request - Next.js request
 * @param context - route context
 * @returns 更新結果
 * @example
 * await PATCH(request, context);
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const access = await requireStudioApiAccess();
  if (access.response) {
    return access.response;
  }

  try {
    const { id } = await context.params;
    const eventId = parseRequiredInteger(id, "id");
    const current = await fetchAdminEventById(eventId);
    if (!current) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const body = await readJsonObject(request);
    const input = parseEventUpdateInput(body, current);
    const event = await updateEvent(eventId, input);
    return NextResponse.json(event);
  } catch (error) {
    return buildStudioErrorResponse(error, "Failed to update event.");
  }
}

/**
 * Studio からイベントを削除する。
 *
 * @param _request - Next.js request
 * @param context - route context
 * @returns 204 response
 * @example
 * await DELETE(request, context);
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const access = await requireStudioApiAccess();
  if (access.response) {
    return access.response;
  }

  try {
    const { id } = await context.params;
    const eventId = parseRequiredInteger(id, "id");
    await deleteEvent(eventId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return buildStudioErrorResponse(error, "Failed to delete event.");
  }
}
