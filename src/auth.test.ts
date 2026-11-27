import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";

const captured = vi.hoisted(() => ({ config: null as NextAuthConfig | null, sync: vi.fn() }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => { captured.config = config; return {}; } }));
vi.mock("@/lib/authServer", () => ({ syncAppUserFromIdentity: captured.sync }));
import "@/auth";

beforeEach(() => {
  captured.sync.mockReset();
  captured.sync.mockResolvedValue({ id: 9, display_name: "Traveler", role: "user" });
});

/**
 * Auth.js callbackをOAuthログインの形で呼ぶ。
 * @param subject - ログインごとの初期UUID @param provider - OAuth provider
 * @returns 更新JWT
 * @example login("random-1", "google");
 */
async function login(subject: string, provider: "google" | "github") {
  const jwt = captured.config!.callbacks!.jwt!;
  return jwt({ token: { sub: subject }, user: { id: subject }, account: { provider, providerAccountId: "123", type: "oauth" }, trigger: "signIn" });
}

describe("OAuth identity", () => {
  it("同一OAuthアカウントの再ログインで同じDBキーになる", async () => {
    const first = await login("random-1", "google");
    const second = await login("random-2", "google");
    expect(first?.sub).toBe("oauth:google:123");
    expect(first?.sub).toBe(second?.sub);
    expect(captured.sync).toHaveBeenLastCalledWith(expect.objectContaining({ identityId: "oauth:google:123" }));
  });
  it("同じproviderAccountIdでも異なるproviderを統合しない", async () => {
    expect((await login("random-1", "google"))?.sub).not.toBe((await login("random-2", "github"))?.sub);
  });
  it("クライアントのsession updateでidentityとroleを上書きしない", async () => {
    const token = await captured.config!.callbacks!.jwt!({
      token: { sub: "oauth:google:123", role: "user" }, user: { id: "attacker" }, account: null,
      trigger: "update", session: { user: { id: "other", role: "super_admin" } },
    });
    expect(token?.sub).toBe("oauth:google:123");
    expect(token?.role).toBe("user");
    expect(captured.sync).not.toHaveBeenCalled();
  });
});

describe("プロフィール最小化", () => {
  it("OAuthプロフィールをDB同期へ渡さず、既存JWTからも削除する", async () => {
    const token = await captured.config!.callbacks!.jwt!({
      token: { sub: "oauth:google:123", email: "old@example.com", name: "Old Name", picture: "https://example.com/photo", displayName: "Old Name" },
      user: { id: "123", email: "new@example.com", name: "New Name", image: "https://example.com/new" },
      account: { provider: "google", providerAccountId: "123", type: "oauth" }, trigger: "signIn",
    });
    expect(captured.sync).toHaveBeenCalledWith({ identityId: "oauth:google:123" });
    expect(token).toEqual({ sub: "oauth:google:123", role: "user" });
  });

  it("プロフィールをセッションAPIから返さない", async () => {
    const callback = captured.config!.callbacks!.session!;
    const result = await callback({
      session: { user: { id: "123", email: "test@example.com", name: "Name", image: "https://example.com/photo" }, expires: "2030-01-01" },
      token: { sub: "oauth:google:123", role: "user" },
    } as unknown as Parameters<typeof callback>[0]);
    expect(result.user).toEqual({ id: "oauth:google:123", role: "user" });
  });
});

describe("通常のセッション確認", () => {
  it("既存Cookieの読み取りではDB同期せず、プロフィールだけ除く", async () => {
    const token = await captured.config!.callbacks!.jwt!({
      token: { sub: "oauth:github:123", role: "admin", email: "old@example.com", name: "Old", picture: "photo", displayName: "Old" },
      user: { id: "ignored" }, account: null,
    });
    expect(token).toEqual({ sub: "oauth:github:123", role: "admin" });
    expect(captured.sync).not.toHaveBeenCalled();
  });

  it("OAuth callbackでないuser.idから本人IDや行を作らない", async () => {
    const token = await captured.config!.callbacks!.jwt!({ token: {}, user: { id: "unverified" }, account: null });
    expect(token).toEqual({});
    expect(captured.sync).not.toHaveBeenCalled();
  });

  it("同期先に行がなくてもCookie更新で再作成せず、再ログイン時だけ同期する", async () => {
    captured.sync.mockResolvedValue(null);
    const jwt = captured.config!.callbacks!.jwt!;
    const existing = { sub: "oauth:google:123", role: "user" } as const;
    await jwt({ token: { ...existing }, user: { id: "123" }, account: null });
    await jwt({ token: { ...existing }, user: { id: "123" }, account: null, trigger: "update", session: {} });
    expect(captured.sync).not.toHaveBeenCalled();
    expect((await login("new-id", "google"))?.sub).toBe(existing.sub);
    expect(captured.sync).toHaveBeenCalledTimes(1);
  });
});
