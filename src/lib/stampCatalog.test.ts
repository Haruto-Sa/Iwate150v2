import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mockStampCatalog } from "./mockData";
import type { Spot } from "./types";

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
      gt: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      abortSignal: vi.fn().mockResolvedValue(tableResults[table]),
    };
    for (const key of [
      "select",
      "not",
      "gte",
      "gt",
      "lte",
      "order",
      "limit",
    ] as const)
      query[key].mockReturnValue(query);
    return query;
  });
}

/**
 * サーバー側の件数制限と次ページでの障害を再現する。
 * @param rows - DBの対象行
 * @param serverPageSize - サーバーが返す最大件数
 * @param failAfter - 取得済み件数がこの値に達したら通信失敗
 * @returns なし
 * @example installPagedSpots(mockStampCatalog.spots, 2);
 */
function installPagedSpots(rows: Spot[], serverPageSize: number, failAfter = Infinity) {
  from.mockImplementation((table: string) => {
    let cursor = -Infinity;
    let requestedLimit = Infinity;
    const query = {
      select: vi.fn(), not: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(),
      gt: vi.fn((_column: string, id: number) => { cursor = id; return query; }),
      limit: vi.fn((limit: number) => { requestedLimit = limit; return query; }),
      abortSignal: vi.fn(async () => {
        if (table === "cities") return { data: mockStampCatalog.cities, error: null };
        if (rows.filter((row) => row.id <= cursor).length >= failAfter) {
          return { data: null, error: { message: "second page unavailable" } };
        }
        return {
          data: rows.filter((row) => row.id > cursor).slice(0, Math.min(serverPageSize, requestedLimit)),
          error: null,
        };
      }),
    };
    for (const key of ["select", "not", "gte", "lte", "order"] as const) {
      query[key].mockReturnValue(query);
    }
    return query;
  });
}

it.each([500, 200])("サーバーのページ上限%d件でも501件目まで欠落なく返す", async (pageSize) => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ ...mockStampCatalog.spots[0], id: index + 1 }));
  installPagedSpots(rows, pageSize);
  const { loadStampCatalog } = await import("./supabaseClient");
  expect(await loadStampCatalog()).toEqual({ spots: rows, cities: mockStampCatalog.cities, isSample: false });
});

it("次ページの取得失敗時は途中までの実データを返さない", async () => {
  installPagedSpots(mockStampCatalog.spots, 2, 2);
  const { loadStampCatalog } = await import("./supabaseClient");
  expect(await loadStampCatalog()).toEqual(mockStampCatalog);
});

it("取得回数の制限に達した場合も不完全な一覧を実データとして返さない", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({ ...mockStampCatalog.spots[0], id: index + 1 }));
  installPagedSpots(rows, 1);
  const { loadStampCatalog } = await import("./supabaseClient");
  expect(await loadStampCatalog()).toEqual(mockStampCatalog);
  expect(from.mock.calls.filter(([table]) => table === "spots")).toHaveLength(100);
});
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
  const { fetchStampCatalog } = await import("./privateUserClient");
  expect(await fetchStampCatalog()).toEqual(mockStampCatalog);
  expect(await fetchStampCatalog()).toEqual(mockStampCatalog);
});
