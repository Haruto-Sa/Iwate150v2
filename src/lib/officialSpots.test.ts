import { afterEach, describe, expect, it, vi } from "vitest";
import officialSpots from "@/data/official-spots.json";
import { mockCities, mockGenres, mockSpots } from "./mockData";
import { IWATE_PUBLIC_BOUNDS } from "./config";

afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock("@supabase/supabase-js"); vi.resetModules(); });
describe("公式確認スポット", () => {
  it("既存IDを保持し、追加施設のID・分類・座標・出典を整合させる", () => {
    expect(mockSpots.slice(0, 4).map(spot => spot.id)).toEqual([1, 2, 3, 4]);
    expect(new Set(mockSpots.map(spot => spot.id)).size).toBe(mockSpots.length);
    expect(new Set(mockCities.map(city => city.id)).size).toBe(mockCities.length);
    for (const entry of officialSpots) {
      const spot = mockSpots.find(item => item.id === entry.mockId)!;
      expect(spot.name).toBe(entry.name);
      expect(mockCities.find(city => city.id === spot.city_id)?.name).toBe(entry.city);
      expect(mockGenres.some(genre => genre.id === spot.genre_id)).toBe(true);
      expect(spot.lat).toBeGreaterThanOrEqual(IWATE_PUBLIC_BOUNDS.minLat);
      expect(spot.lat).toBeLessThanOrEqual(IWATE_PUBLIC_BOUNDS.maxLat);
      expect(spot.lng).toBeGreaterThanOrEqual(IWATE_PUBLIC_BOUNDS.minLng);
      expect(spot.lng).toBeLessThanOrEqual(IWATE_PUBLIC_BOUNDS.maxLng);
      expect(spot.image_path).toBeNull();
      expect(spot.model_path).toBeNull();
      expect(new URL(entry.sourceUrl).hostname).toBe("iwatetabi.jp");
      expect(new URL(spot.reference_url!).protocol).toBe("https:");
    }
  });
  it("DB未設定時も市町村・ジャンル・キーワードで検索し詳細を開ける", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { searchSpots, fetchSpot } = await import("./supabaseClient");
    for (const entry of officialSpots) {
      const result = await searchSpots({ keyword: entry.name, cityId: entry.mockCityId, genreId: entry.mockGenreId });
      expect(result.items.map(spot => spot.name)).toEqual([entry.name]);
      expect((await fetchSpot(entry.mockId))?.reference_url).toBe(entry.referenceUrl);
      const otherGenre = await searchSpots({ keyword: entry.name, cityId: entry.mockCityId, genreId: 3 });
      expect(otherGenre.items).toEqual([]);
    }
  });
  it("設定済みDBの取得失敗時も公式施設を検索できる", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    const query: Record<string, unknown> = {};
    for (const method of ["from", "select", "not", "gte", "lte", "order", "eq", "or"]) query[method] = vi.fn(() => query);
    query.range = vi.fn().mockResolvedValue({ data: null, error: { code: "unavailable" }, count: null });
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => query }));
    const { searchSpots } = await import("./supabaseClient");
    const result = await searchSpots({ keyword: "鉄の歴史館", cityId: 5, genreId: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ name: "鉄の歴史館", isSample: true, image_path: null });
  });

});
