import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ identity: "oauth:google:A" as string | null, unavailable: false, failure: false }));
vi.mock("@/auth", () => ({ auth: async () => state.identity ? { user: { id: state.identity } } : null }));
const records: Record<string, Record<string, unknown>[]> = {
  users: [{ id: 1, auth_id: "oauth:google:A" }, { id: 2, auth_id: "oauth:google:B" }],
  favorites: [], stamps: [],
};
/**
 * 所有者条件を実際に評価するインメモリDB。実RLS検証の代替ではない。
 * @param table - テーブル名 @returns Supabase風query
 * @example query("favorites");
 */
function query(table: string) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];
  let deletion = false;
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return builder; },
    in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return builder; },
    order: () => builder,
    range: async (start: number, end: number) => ({ data: records[table].filter((row) => filters.every((filter) => filter(row))).slice(start, end + 1), error: state.failure ? {} : null }),
    maybeSingle: async () => ({ data: records[table].find((row) => filters.every((filter) => filter(row))) ?? null, error: state.failure ? {} : null }),
    delete: () => { deletion = true; return builder; },
    upsert: async (rows: Record<string, unknown>[]) => {
      if (state.failure) return { error: { code: "failure" } };
      for (const row of rows) {
        if (!records[table].some((existing) => existing.user_id === row.user_id && existing.spot_id === row.spot_id)) records[table].push({ id: records[table].length + 1, ...row });
      }
      return { error: null };
    },
    then: (resolve: (result: unknown) => unknown) => {
      const matching = records[table].filter((row) => filters.every((filter) => filter(row)));
      if (deletion && !state.failure) {
        records[table] = records[table].filter((row) => !matching.includes(row));
        // schema.sqlの連鎖削除をモデル化する。実DB制約の検証ではない。
        if (table === "users") {
          for (const child of ["stamps", "favorites"]) {
            records[child] = records[child].filter((row) => !matching.some((owner) => owner.id === row.user_id));
          }
        }
      }
      return Promise.resolve(resolve({ data: matching, error: state.failure ? {} : null }));
    },
  };
  return builder;
}
vi.mock("@/lib/authServer", () => ({ getServerAdminClient: () => state.unavailable ? null : { from: query } }));
import { GET, PUT, POST, DELETE } from "@/app/api/me/favorites/route";
import { GET as getStamps, POST as postStamp } from "@/app/api/me/stamps/route";
import { DELETE as deleteOwnData } from "@/app/api/me/route";

/** @param method - HTTP method @param body - 本文 @param origin - 送信元 @returns request @example request("PUT", {spotId: 3}); */
function request(method = "GET", body?: unknown, origin = "https://app.test"): Request {
  return new Request("https://app.test/api/me/favorites", { method,
    headers: { origin, "content-type": "application/json", "x-session-user": state.identity ?? "" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

beforeEach(() => {
  delete process.env.AUTH_URL;
  state.identity = "oauth:google:A"; state.unavailable = false; state.failure = false;
  records.users = [{ id: 1, auth_id: "oauth:google:A" }, { id: 2, auth_id: "oauth:google:B" }];
  records.favorites = [{ id: 1, user_id: 1, spot_id: 10 }, { id: 2, user_id: 2, spot_id: 20 }];
  records.stamps = [{ id: 1, user_id: 2, spot_id: 20 }];
});

describe("本人の保存データを全削除", () => {
  it("削除本文のサイズ超過とタイムアウトで記録を変更しない", async () => {
    expect((await deleteOwnData(request("DELETE", { confirmation: "x".repeat(8192) }))).status).toBe(413);
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const stalled = {
        url: "https://app.test/api/me", method: "DELETE",
        headers: new Headers({ origin: "https://app.test", "content-type": "application/json", "x-session-user": "oauth:google:A" }),
        body: new ReadableStream<Uint8Array>({ cancel }),
      } as Request;
      const response = deleteOwnData(stalled);
      await vi.advanceTimersByTimeAsync(5000);
      expect((await response).status).toBe(408);
      expect(cancel).toHaveBeenCalledOnce();
      expect(records.users).toHaveLength(2);
      expect(records.favorites).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it("Aの登録と記録だけを削除し、Bを保持して再送も成功する", async () => {
    records.stamps.push({ id: 2, user_id: 1, spot_id: 30 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await deleteOwnData(request("DELETE", { confirmation: "delete" }));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(records.users).toEqual([{ id: 2, auth_id: "oauth:google:B" }]);
    expect(records.favorites).toEqual([{ id: 2, user_id: 2, spot_id: 20 }]);
    expect(records.stamps).toEqual([{ id: 1, user_id: 2, spot_id: 20 }]);
  });

  it("未認証・確認なし・所有者指定・別Origin・利用者変更を拒否する", async () => {
    expect((await deleteOwnData(request("DELETE", {}))).status).toBe(400);
    expect((await deleteOwnData(request("DELETE", { confirmation: "delete", userId: 2 }))).status).toBe(400);
    expect((await deleteOwnData(request("DELETE", { confirmation: "delete" }, "https://evil.test"))).status).toBe(403);
    const oldRequest = request("DELETE", { confirmation: "delete" });
    state.identity = "oauth:google:B";
    expect((await deleteOwnData(oldRequest)).status).toBe(409);
    state.identity = null;
    expect((await deleteOwnData(request("DELETE", { confirmation: "delete" }))).status).toBe(401);
    expect(records.users).toHaveLength(2);
    expect(records.favorites).toHaveLength(2);
  });

  it("DB障害・設定不足で削除成功を返さない", async () => {
    state.failure = true;
    expect((await deleteOwnData(request("DELETE", { confirmation: "delete" }))).status).toBe(503);
    state.failure = false;
    state.unavailable = true;
    expect((await deleteOwnData(request("DELETE", { confirmation: "delete" }))).status).toBe(503);
    expect(records.users).toHaveLength(2);
    expect(records.favorites).toHaveLength(2);
  });

  it("本人確認ヘッダーなしとクエリでの所有者指定を拒否する", async () => {
    const missingIdentity = request("DELETE", { confirmation: "delete" });
    missingIdentity.headers.delete("x-session-user");
    expect((await deleteOwnData(missingIdentity)).status).toBe(409);
    const withQuery = new Request("https://app.test/api/me?userId=2", {
      method: "DELETE", headers: { origin: "https://app.test", "x-session-user": "oauth:google:A", "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "delete" }),
    });
    expect((await deleteOwnData(withQuery)).status).toBe(400);
    expect(records.users).toHaveLength(2);
  });
});

describe("本人API", () => {
  it("全操作で未認証を401にしキャッシュを禁止する", async () => {
    state.identity = null;
    for (const [handler, method] of [[GET, "GET"], [PUT, "PUT"], [POST, "POST"], [DELETE, "DELETE"], [getStamps, "GET"], [postStamp, "POST"]] as const) {
      const response = await handler(request(method));
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
  it("同一APIでもセッションA/Bの一覧を分離する", async () => {
    expect((await (await GET(request())).json()).items.map((row: { spot_id: number }) => row.spot_id)).toEqual([10]);
    state.identity = "oauth:google:B";
    expect((await (await GET(request())).json()).items.map((row: { spot_id: number }) => row.spot_id)).toEqual([20]);
  });
  it("本文とクエリの所有者指定を拒否する", async () => {
    expect((await PUT(request("PUT", { spotId: 20, userId: 2 }))).status).toBe(400);
    expect((await GET(new Request("https://app.test/api/me/favorites?userId=2"))).status).toBe(400);
    expect(records.favorites).toHaveLength(2);
  });
  it("Bのスポットを削除してもBの行を消さず、新規保存はAに紐づく", async () => {
    expect((await DELETE(request("DELETE", { spotId: 20 }))).status).toBe(200);
    expect(records.favorites).toContainEqual({ id: 2, user_id: 2, spot_id: 20 });
    await PUT(request("PUT", { spotId: 20 }));
    expect(records.favorites).toContainEqual({ id: 3, user_id: 1, spot_id: 20 });
  });
  it("CSRFと送信中のユーザー変更を拒否する", async () => {
    expect((await PUT(request("PUT", { spotId: 30 }, "https://evil.test"))).status).toBe(403);
    const oldRequest = request("PUT", { spotId: 30 });
    state.identity = "oauth:google:B";
    expect((await PUT(oldRequest)).status).toBe(409);
    expect(records.favorites).toHaveLength(2);
  });
  it("同期の再送が重複せずDB保存済みIDのみ返る", async () => {
    for (let n = 0; n < 2; n++) {
      const response = await POST(request("POST", { spotIds: [10, 30, 30] }));
      expect((await response.json()).persistedSpotIds).toEqual([10, 30]);
    }
    expect(records.favorites.filter((row) => row.user_id === 1)).toHaveLength(2);
  });
  it("stampでも本人の所有者だけを使い再送は冪等", async () => {
    expect((await (await getStamps(request())).json()).items).toEqual([]);
    await postStamp(request("POST", { spotId: 20 }));
    await postStamp(request("POST", { spotId: 20 }));
    expect(records.stamps.filter((row) => row.user_id === 1)).toHaveLength(1);
    expect(records.stamps.filter((row) => row.user_id === 2)).toHaveLength(1);
  });
  it("DB障害/設定不足は保存成功やモックを返さない", async () => {
    state.failure = true;
    expect((await POST(request("POST", { spotIds: [30] }))).status).toBe(503);
    state.failure = false; state.unavailable = true;
    expect((await getStamps(request())).status).toBe(503);
    expect(records.favorites).toHaveLength(2);
  });
  it("不正ID・多すぎる項目・過大本文を拒否する", async () => {
    expect((await PUT(request("PUT", { spotId: -1 }))).status).toBe(400);
    expect((await POST(request("POST", { spotIds: Array(101).fill(1) }))).status).toBe(400);
    expect((await POST(request("POST", { spotIds: ["x".repeat(9000)] }))).status).toBe(413);
  });
});
