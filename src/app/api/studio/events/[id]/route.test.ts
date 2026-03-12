import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/studio/events/[id]/route";

const {
  mockRequireStudioApiAccess,
  mockFetchAdminEventById,
  mockUpdateEvent,
  mockDeleteEvent,
} = vi.hoisted(() => ({
  mockRequireStudioApiAccess: vi.fn(),
  mockFetchAdminEventById: vi.fn(),
  mockUpdateEvent: vi.fn(),
  mockDeleteEvent: vi.fn(),
}));

vi.mock("@/lib/studioApi", async () => {
  return {
    buildStudioErrorResponse: (error: unknown, fallbackMessage: string) =>
      NextResponse.json(
        { error: error instanceof Error ? error.message : fallbackMessage },
        { status: error instanceof Error ? 400 : 500 }
      ),
    parseRequiredInteger: (value: string, fieldName: string) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
      }
      return parsed;
    },
    readJsonObject: async (request: Request) => (await request.json()) as Record<string, unknown>,
    requireStudioApiAccess: mockRequireStudioApiAccess,
  };
});

vi.mock("@/lib/studioPayloads", () => ({
  parseEventUpdateInput: (input: Record<string, unknown>) => input,
}));

vi.mock("@/lib/adminServer", () => ({
  AdminServerConfigError: class AdminServerConfigError extends Error {},
  AdminServerNotFoundError: class AdminServerNotFoundError extends Error {},
  fetchAdminEventById: mockFetchAdminEventById,
  updateEvent: mockUpdateEvent,
  deleteEvent: mockDeleteEvent,
}));

describe("PATCH /api/studio/events/[id]", () => {
  beforeEach(() => {
    mockRequireStudioApiAccess.mockReset();
    mockFetchAdminEventById.mockReset();
    mockUpdateEvent.mockReset();
    mockDeleteEvent.mockReset();
  });

  it("returns 404 when the target event does not exist", async () => {
    mockRequireStudioApiAccess.mockResolvedValue({
      currentUser: {
        id: 1,
        auth_id: "admin-user",
        email: "admin@example.com",
        role: "admin",
        display_name: "Admin",
        created_at: "2026-03-12T00:00:00.000Z",
      },
    });
    mockFetchAdminEventById.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/studio/events/999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "更新イベント" }),
      }),
      { params: Promise.resolve({ id: "999" }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Event not found." });
  });

  it("returns 200 when the event is updated", async () => {
    mockRequireStudioApiAccess.mockResolvedValue({
      currentUser: {
        id: 1,
        auth_id: "admin-user",
        email: "admin@example.com",
        role: "admin",
        display_name: "Admin",
        created_at: "2026-03-12T00:00:00.000Z",
      },
    });
    mockFetchAdminEventById.mockResolvedValue({
      id: 5,
      title: "元イベント",
      location: "盛岡市",
      start_date: "2026-03-12",
      end_date: "2026-03-13",
      city_id: 1,
    });
    mockUpdateEvent.mockResolvedValue({
      id: 5,
      title: "更新イベント",
      location: "盛岡市",
      start_date: "2026-03-12",
      end_date: "2026-03-13",
      city_id: 1,
    });

    const response = await PATCH(
      new Request("http://localhost/api/studio/events/5", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "更新イベント" }),
      }),
      { params: Promise.resolve({ id: "5" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateEvent).toHaveBeenCalledWith(5, { title: "更新イベント" });
  });

  it("returns 204 when the event is deleted", async () => {
    mockRequireStudioApiAccess.mockResolvedValue({
      currentUser: {
        id: 1,
        auth_id: "admin-user",
        email: "admin@example.com",
        role: "admin",
        display_name: "Admin",
        created_at: "2026-03-12T00:00:00.000Z",
      },
    });
    mockDeleteEvent.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/studio/events/5", { method: "DELETE" }),
      { params: Promise.resolve({ id: "5" }) }
    );

    expect(response.status).toBe(204);
    expect(mockDeleteEvent).toHaveBeenCalledWith(5);
  });
});
