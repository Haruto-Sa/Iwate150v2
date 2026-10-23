import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  auth: vi.fn(), profile: vi.fn(), createSpot: vi.fn(), createEvent: vi.fn(),
  updateSpot: vi.fn(), updateEvent: vi.fn(), deleteSpot: vi.fn(), deleteEvent: vi.fn(),
  fetchAdminSpotById: vi.fn(), fetchAdminEventById: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: state.auth }));
vi.mock("@/lib/authServer", () => ({ fetchAppUserByIdentity: state.profile }));
vi.mock("@/lib/adminServer", () => ({
  ...state,
  AdminServerConfigError: class extends Error {},
  AdminServerNotFoundError: class extends Error {},
}));
import { POST as createSpot } from "@/app/api/studio/spots/route";
import { POST as createEvent } from "@/app/api/studio/events/route";
import { PATCH as updateSpot, DELETE as deleteSpot } from "@/app/api/studio/spots/[id]/route";
import { PATCH as updateEvent, DELETE as deleteEvent } from "@/app/api/studio/events/[id]/route";

const cases = [
  { name: "create spot", method: "POST", handler: createSpot, db: state.createSpot, body: { name: "公園", description: "説明", city_id: 1, genre_id: 1, lat: 39, lng: 141 }, status: 201 },
  { name: "create event", method: "POST", handler: createEvent, db: state.createEvent, body: { title: "祭り" }, status: 201 },
  { name: "update spot", method: "PATCH", handler: updateSpot, db: state.updateSpot, body: { name: "公園" }, status: 200 },
  { name: "update event", method: "PATCH", handler: updateEvent, db: state.updateEvent, body: { title: "祭り" }, status: 200 },
  { name: "delete spot", method: "DELETE", handler: deleteSpot, db: state.deleteSpot, status: 204 },
  { name: "delete event", method: "DELETE", handler: deleteEvent, db: state.deleteEvent, status: 204 },
];
const writes = [state.createSpot, state.createEvent, state.updateSpot, state.updateEvent, state.deleteSpot, state.deleteEvent];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_URL", "https://app.example");
  state.auth.mockResolvedValue({ user: { id: "admin" } });
  state.profile.mockResolvedValue({ role: "admin" });
  state.fetchAdminSpotById.mockResolvedValue({ id: 1 });
  state.fetchAdminEventById.mockResolvedValue({ id: 1 });
  for (const write of writes) write.mockResolvedValue({ id: 1 });
});
afterEach(() => vi.unstubAllEnvs());

for (const item of cases) describe(item.name, () => {
  /** @param origin - 送信元 @param body - 本文 @param contentType - MIME @returns HTTP request @example request() */
  function request(origin = "https://app.example", body = item.body ? JSON.stringify(item.body) : undefined, contentType = "application/json") {
    return new Request("https://internal.example/api/studio/resource", {
      method: item.method, headers: { Origin: origin, "Content-Type": contentType }, body,
    });
  }
  const context = { params: Promise.resolve({ id: "1" }) };
  it("管理者の正常操作を保持する", async () => {
    expect((await item.handler(request(), context)).status).toBe(item.status);
    expect(item.db).toHaveBeenCalledOnce();
  });
  it.each(["https://other.example", "null", ""])("異なる/無効なOrigin %s をDB処理前に拒否する", async origin => {
    expect((await item.handler(request(origin), context)).status).toBe(403);
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(state.fetchAdminSpotById).not.toHaveBeenCalled();
    expect(state.fetchAdminEventById).not.toHaveBeenCalled();
  });
  it("未認証・一般ユーザーには書き込ませない", async () => {
    state.auth.mockResolvedValue(null);
    expect((await item.handler(request(), context)).status).toBe(401);
    state.auth.mockResolvedValue({ user: { id: "user" } });
    state.profile.mockResolvedValue({ role: "user" });
    expect((await item.handler(request(), context)).status).toBe(403);
    expect(item.db).not.toHaveBeenCalled();
  });
  it("DB内部のエラー文を公開しない", async () => {
    item.db.mockRejectedValue(new Error("private DB constraint users_email_key secret@example.com"));
    const response = await item.handler(request(), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/private DB|users_email_key|secret@example/);
  });
  it("認証基盤の例外も固定応答にする", async () => {
    state.auth.mockRejectedValue(new Error("private session detail"));
    const response = await item.handler(request(), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private session");
    expect(item.db).not.toHaveBeenCalled();
  });
  if (item.body) it.each([
    ["plain text", "{}", "text/plain", 415],
    ["oversized", JSON.stringify({ name: "あ".repeat(12000) }), "application/json", 413],
    ["malformed", "{", "application/json", 400],
    ["array", "[]", "application/json", 400],
    ["unknown key", JSON.stringify({ ...item.body, role: "super_admin" }), "application/json", 400],
  ])("%s をDB処理前に拒否する", async (_, body, type, status) => {
    expect((await item.handler(request("https://app.example", String(body), String(type)), context)).status).toBe(status);
    expect(item.db).not.toHaveBeenCalled();
    expect(state.fetchAdminSpotById).not.toHaveBeenCalled();
    expect(state.fetchAdminEventById).not.toHaveBeenCalled();
  });
});
