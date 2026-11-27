import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/studio/spots/route";

const { mockRequireStudioApiAccess, mockCreateSpot } = vi.hoisted(() => ({
  mockRequireStudioApiAccess: vi.fn(),
  mockCreateSpot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/authServer", () => ({ fetchAppUserByIdentity: vi.fn() }));
vi.mock("@/lib/studioApi", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/studioApi")>(),
  requireStudioApiAccess: mockRequireStudioApiAccess,
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
        headers: { "Content-Type": "application/json", Origin: "http://localhost" },
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
        headers: { "Content-Type": "application/json", Origin: "http://localhost" },
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
