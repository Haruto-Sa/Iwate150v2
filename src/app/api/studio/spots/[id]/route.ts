import { NextResponse } from "next/server";
import { deleteSpot, fetchAdminSpotById, updateSpot } from "@/lib/adminServer";
import { buildStudioErrorResponse, parseRequiredInteger, readJsonObject, requireStudioApiAccess } from "@/lib/studioApi";
import { parseSpotUpdateInput } from "@/lib/studioPayloads";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Studio からスポットを更新する。
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
    const spotId = parseRequiredInteger(id, "id");
    const current = await fetchAdminSpotById(spotId);
    if (!current) {
      return NextResponse.json({ error: "Spot not found." }, { status: 404 });
    }

    const body = await readJsonObject(request);
    const input = parseSpotUpdateInput(body);
    const spot = await updateSpot(spotId, input);
    return NextResponse.json(spot);
  } catch (error) {
    return buildStudioErrorResponse(error, "Failed to update spot.");
  }
}

/**
 * Studio からスポットを削除する。
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
    const spotId = parseRequiredInteger(id, "id");
    await deleteSpot(spotId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return buildStudioErrorResponse(error, "Failed to delete spot.");
  }
}
