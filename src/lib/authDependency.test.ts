import { describe, expect, it } from "vitest";
import { getToken } from "next-auth/jwt";

describe("Auth.jsの不正Bearer処理", () => {
  it.each(["%", "%ZZ", "%E0%A4%A"])("不正エンコード %s を例外にせず未認証にする", async token => {
    const req = new Request("https://app.test/api/me/favorites", {
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(getToken({ req, secret: "unit-test-only-secret" })).resolves.toBeNull();
  });
});
