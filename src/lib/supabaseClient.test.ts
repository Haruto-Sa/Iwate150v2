import { afterEach, describe, expect, it, vi } from "vitest";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase 環境変数を未設定状態へ戻す。
 *
 * @returns なし
 * @example
 * resetSupabaseEnv();
 */
function resetSupabaseEnv(): void {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

describe("fetchSpots", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    if (originalSupabaseUrl) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }

    if (originalSupabaseAnonKey) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  });

  it("既定では Supabase 未設定時にモックスポットへフォールバックする", async () => {
    resetSupabaseEnv();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchSpots } = await import("@/lib/supabaseClient");
    const spots = await fetchSpots();

    expect(spots.length).toBeGreaterThan(0);
    expect(spots[0]?.id).toBeTypeOf("number");
  });

  it("fallback が empty の場合は Supabase 未設定でも空配列を返す", async () => {
    resetSupabaseEnv();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchSpots } = await import("@/lib/supabaseClient");
    const spots = await fetchSpots({ fallback: "empty" });

    expect(spots).toEqual([]);
  });
  it("公開検索の既定50件とスポット・イベントの2ページ目を維持する", async () => {
    resetSupabaseEnv();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { searchSpots, searchEvents } = await import("./supabaseClient");
    for (const search of [searchSpots, searchEvents]) {
      const all = await search({});
      expect(all.pageSize).toBe(50);
      expect(all.items.length).toBeGreaterThan(1);
      const second = await search({ page: 2, pageSize: 1 });
      expect(second.items).toEqual([all.items[1]]);
      expect(second).toMatchObject({ page: 2, pageSize: 1, total: all.total, hasNext: all.total > 2 });
    }
  });

});
