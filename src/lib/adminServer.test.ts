import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminServerNotFoundError,
  createSpot,
  fetchAdminSpotsPage,
  fetchAdminEventsPage,
  updateEvent,
} from "@/lib/adminServer";

vi.mock("server-only", () => ({}));

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

  it("管理一覧の既定20件とスポット・イベントの2ページ目を維持する", async () => {
    mockGetServerAdminClient.mockReturnValue(null);
    for (const fetchPage of [fetchAdminSpotsPage, fetchAdminEventsPage]) {
      const all = await fetchPage(1);
      expect(all.pageSize).toBe(20);
      expect(all.items.length).toBeGreaterThan(1);
      const second = await fetchPage(2, 1);
      expect(second.items).toEqual([all.items[1]]);
      expect(second).toMatchObject({ page: 2, pageSize: 1, total: all.total, hasNext: all.total > 2 });
    }
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
  it("DB失敗のコードだけを記録し内部メッセージを渡さない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetServerAdminClient.mockReturnValue({
      from: () => ({ update: () => ({ eq: () => ({ select: () => ({
        maybeSingle: async () => ({ data: null, error: {
          code: "23505", message: "private user@example.com", details: "private detail", hint: "private hint",
        } }),
      }) }) }) }),
    });
    try {
      await expect(updateEvent(1, { title: "更新" })).rejects.toThrow("管理データの処理に失敗しました。");
      expect(warn).toHaveBeenCalledWith("[adminServer] database operation failed", { code: "23505" });
      expect(JSON.stringify(warn.mock.calls)).not.toContain("private");
    } finally { warn.mockRestore(); }
  });

});
