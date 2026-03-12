import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/studio/spots/route";

const { mockRequireStudioApiAccess, mockCreateSpot } = vi.hoisted(() => ({
  mockRequireStudioApiAccess: vi.fn(),
  mockCreateSpot: vi.fn(),
}));

vi.mock("@/lib/studioApi", async () => {
  return {
    buildStudioErrorResponse: (error: unknown, fallbackMessage: string) =>
      NextResponse.json(
        { error: error instanceof Error ? error.message : fallbackMessage },
        { status: error instanceof Error ? 400 : 500 }
      ),
    readJsonObject: async (request: Request) => (await request.json()) as Record<string, unknown>,
    requireStudioApiAccess: mockRequireStudioApiAccess,
  };
});

vi.mock("@/lib/studioPayloads", () => ({
  parseSpotCreateInput: (input: Record<string, unknown>) => {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new Error("name is required.");
    }
    if (typeof input.description !== "string" || !input.description.trim()) {
      throw new Error("description is required.");
    }
    return {
      name: input.name.trim(),
      description: input.description.trim(),
      city_id: Number(input.city_id),
      genre_id: Number(input.genre_id),
      lat: Number(input.lat),
      lng: Number(input.lng),
      image_thumb_path: input.image_thumb_path ? String(input.image_thumb_path) : null,
      image_path: input.image_path ? String(input.image_path) : null,
      model_path: input.model_path ? String(input.model_path) : null,
      reference_url: input.reference_url ? String(input.reference_url) : null,
    };
  },
}));

vi.mock("@/lib/adminServer", () => ({
  AdminServerConfigError: class AdminServerConfigError extends Error {},
  AdminServerNotFoundError: class AdminServerNotFoundError extends Error {},
  createSpot: mockCreateSpot,
}));

describe("POST /api/studio/spots", () => {
  beforeEach(() => {
    mockRequireStudioApiAccess.mockReset();
    mockCreateSpot.mockReset();
  });

  it("returns 401 when access is not allowed", async () => {
    mockRequireStudioApiAccess.mockResolvedValue({
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    });

    const response = await POST(new Request("http://localhost/api/studio/spots", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 when the payload is invalid", async () => {
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

    const response = await POST(
      new Request("http://localhost/api/studio/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          city_id: 1,
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "name is required.",
    });
  });

  it("returns 201 when a spot is created", async () => {
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
    mockCreateSpot.mockResolvedValue({
      id: 10,
      name: "盛岡城跡公園",
      description: "説明",
      city_id: 1,
      genre_id: 1,
      lat: 39.7,
      lng: 141.1,
      image_thumb_path: null,
      image_path: null,
      model_path: null,
      reference_url: null,
    });

    const response = await POST(
      new Request("http://localhost/api/studio/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "盛岡城跡公園",
          description: "説明",
          city_id: 1,
          genre_id: 1,
          lat: 39.7,
          lng: 141.1,
          image_thumb_path: "",
          image_path: "",
          model_path: "",
          reference_url: "",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateSpot).toHaveBeenCalledWith({
      name: "盛岡城跡公園",
      description: "説明",
      city_id: 1,
      genre_id: 1,
      lat: 39.7,
      lng: 141.1,
      image_thumb_path: null,
      image_path: null,
      model_path: null,
      reference_url: null,
    });
  });
});
