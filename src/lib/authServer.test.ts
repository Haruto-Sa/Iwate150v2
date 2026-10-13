import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ from: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: db.from }) }));
import { syncAppUserFromIdentity } from "./authServer";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: db.maybeSingle, single: db.single, insert: db.insert, update: db.update };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  db.from.mockReturnValue(query);
  db.insert.mockReturnValue(query);
  db.update.mockReturnValue(query);
});

afterEach(() => vi.unstubAllEnvs());

describe("プロフィールを保存しないユーザー同期", () => {
  it("新規登録では識別子・固定表示名・一般ロールだけを保存する", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    db.single.mockResolvedValue({ data: { id: 1, role: "user" }, error: null });
    await syncAppUserFromIdentity({ identityId: "oauth:google:123" });
    expect(db.insert).toHaveBeenCalledWith({ auth_id: "oauth:google:123", email: null, display_name: "Traveler", role: "user" });
  });

  it("既存管理者の権限・IDを変更せずプロフィールを消去する", async () => {
    const existing = { id: 1, role: "super_admin", email: "old@example.com", display_name: "Old Name" };
    db.maybeSingle.mockResolvedValue({ data: existing, error: null });
    db.single.mockResolvedValue({ data: { ...existing, email: null, display_name: "Traveler" }, error: null });
    const result = await syncAppUserFromIdentity({ identityId: "oauth:google:123" });
    expect(db.update).toHaveBeenCalledWith({ email: null, display_name: "Traveler" });
    expect(result?.role).toBe("super_admin");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
