import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminServerNotFoundError,
  createSpot,
  fetchAdminSpotsPage,
  updateEvent,
} from "@/lib/adminServer";

const { mockGetServerAdminClient } = vi.hoisted(() => ({
  mockGetServerAdminClient: vi.fn(),
}));

vi.mock("@/lib/authServer", () => ({
  getServerAdminClient: mockGetServerAdminClient,
}));

describe("adminServer", () => {
  beforeEach(() => {
    mockGetServerAdminClient.mockReset();
  });

  it("falls back to mock spot data when admin client is unavailable", async () => {
    mockGetServerAdminClient.mockReturnValue(null);

    const result = await fetchAdminSpotsPage(1, 2);

    expect(result.total).toBeGreaterThanOrEqual(4);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBeGreaterThan(result.items[1]?.id ?? 0);
    expect(result.items[0]?.city?.name).toBeTruthy();
    expect(result.items[0]?.genre?.name).toBeTruthy();
  });

  it("maps optional spot fields to nullable payload values on create", async () => {
    const inserted: unknown[] = [];
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 99,
        name: "新規スポット",
        description: "説明",
        city_id: 1,
        genre_id: 2,
        lat: 39.7,
        lng: 141.1,
        image_thumb_path: null,
        image_path: null,
        model_path: null,
        reference_url: null,
      },
      error: null,
    });

    mockGetServerAdminClient.mockReturnValue({
      from: () => ({
        insert: (payload: unknown) => {
          inserted.push(payload);
          return {
            select: () => ({
              single,
            }),
          };
        },
      }),
    });

    await createSpot({
      name: "新規スポット",
      description: "説明",
      city_id: 1,
      genre_id: 2,
      lat: 39.7,
      lng: 141.1,
      image_thumb_path: null,
      image_path: null,
      model_path: null,
      reference_url: null,
    });

    expect(inserted[0]).toEqual({
      name: "新規スポット",
      description: "説明",
      city_id: 1,
      genre_id: 2,
      lat: 39.7,
      lng: 141.1,
      image_thumb_path: null,
      image_path: null,
      model_path: null,
      reference_url: null,
    });
    expect(single).toHaveBeenCalledTimes(1);
  });

  it("throws not found error when update target does not exist", async () => {
    mockGetServerAdminClient.mockReturnValue({
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: null,
                error: {
                  code: "PGRST116",
                  details: "",
                  hint: "",
                  message: "No rows",
                },
              }),
            }),
          }),
        }),
      }),
    });

    await expect(updateEvent(77, { title: "更新イベント" })).rejects.toBeInstanceOf(
      AdminServerNotFoundError
    );
  });
});
