import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mockStampCatalog } from "./mockData";

const from = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from }) }));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  from.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/**
 * 公開クエリの終端を差し替える。
 * @param tableResults - テーブルごとのレスポンス
 * @returns なし
 * @example installQuery({ spots: { data: [], error: null } });
 */
function installQuery(
  tableResults: Record<string, { data: unknown; error: unknown }>,
) {
  from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(),
      not: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      abortSignal: vi.fn().mockResolvedValue(tableResults[table]),
    };
    for (const key of [
      "select",
      "not",
      "gte",
      "lte",
      "order",
      "limit",
    ] as const)
      query[key].mockReturnValue(query);
    return query;
  });
}
it("実データは市町村と組で返し、空の実一覧もサンプルと区別する", async () => {
  installQuery({
    spots: { data: [], error: null },
    cities: { data: [], error: null },
  });
  const { loadStampCatalog } = await import("./supabaseClient");
  expect(await loadStampCatalog()).toEqual({
    spots: [],
    cities: [],
    isSample: false,
  });
});
it.each(["spots", "cities"])(
  "%sの失敗時は実スポットとモック自治体を混ぜず、すべて閲覧専用にする",
  async (table) => {
    installQuery({
      spots: { data: [], error: null },
      cities: { data: [], error: null },
      [table]: { data: null, error: { message: "unavailable" } },
    });
    const { loadStampCatalog } = await import("./supabaseClient");
    expect(await loadStampCatalog()).toEqual(mockStampCatalog);
  },
);
it("環境未設定時も閲覧専用サンプルを返す", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  const { loadStampCatalog } = await import("./supabaseClient");
  expect(await loadStampCatalog()).toEqual(mockStampCatalog);
  expect(from).not.toHaveBeenCalled();
});
it("公開APIが失敗・不正形式の場合も保存可能な対象へ変換しない", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spots: [], cities: [] }),
    });
  vi.stubGlobal("fetch", fetch);
  const { fetchStampCatalog } = await import("./supabaseClient");
  expect(await fetchStampCatalog()).toEqual(mockStampCatalog);
  expect(await fetchStampCatalog()).toEqual(mockStampCatalog);
});
