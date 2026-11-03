import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ available: true, failing: "", zero: false, queries: [] as string[] }));
vi.mock("@/lib/authServer", () => ({ getServerAdminClient: () => state.available ? { from: query } : null }));
import { fetchAdminDashboardStats, fetchManageableUsers } from "./adminDashboard";

/**
 * 実環境と同じく登録日時列のないDBをモデル化する。
 * @param table - 対象表
 * @returns Supabase風クエリ
 * @example query("users");
 */
function query(table: string) {
  let fields = "";
  let head = false;
  let admins = false;
  let invalidColumn = false;
  const builder = {
    select: (selection: string, options?: { head?: boolean }) => {
      fields = selection; head = Boolean(options?.head);
      invalidColumn ||= selection.includes("created_at");
      state.queries.push(`${table}:${selection}`);
      return builder;
    },
    order: (field: string) => { invalidColumn ||= field === "created_at"; return builder; },
    in: () => { admins = true; return builder; },
    limit: () => builder,
    then: (resolve: (result: unknown) => unknown) => {
      const error = invalidColumn || state.failing === table ? { message: "unavailable" } : null;
      const count = state.zero ? 0 : table === "users" ? (admins ? 2 : 7) : 12;
      const data = head ? null : table === "users" ? [{ id: 3, auth_id: "A", email: null, display_name: "Traveler", role: "user" }] : [];
      return Promise.resolve(resolve({ data, count: head ? count : null, error, fields }));
    },
  };
  return builder;
}

beforeEach(() => {
  state.available = true; state.failing = ""; state.zero = false; state.queries = [];
});

describe("サーバー専用の管理データ", () => {
  it("登録日時列がなくても集計と利用者一覧を取得する", async () => {
    const stats = await fetchAdminDashboardStats();
    expect(stats).toMatchObject({ totalUsers: 7, totalAdmins: 2, totalSpots: 12, totalEvents: 12 });
    expect(await fetchManageableUsers()).toEqual([{ id: 3, auth_id: "A", email: null, display_name: "Traveler", role: "user" }]);
    expect(state.queries.some((query) => query.includes("created_at"))).toBe(false);
  });
  it("一部の取得失敗を0件にせず、成功した集計は残す", async () => {
    state.failing = "users";
    const stats = await fetchAdminDashboardStats();
    expect(stats).toMatchObject({ totalUsers: null, totalAdmins: null, totalSpots: 12, totalEvents: 12 });
  });
  it("実際の0件と設定不足を区別する", async () => {
    state.zero = true;
    expect((await fetchAdminDashboardStats()).totalUsers).toBe(0);
    state.available = false;
    expect((await fetchAdminDashboardStats()).totalUsers).toBeNull();
  });
});
