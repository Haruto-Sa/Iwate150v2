import { expect, test } from "@playwright/test";

test("本人限定APIは全操作で未認証を拒否しキャッシュさせない", async ({ request }) => {
  const deletion = await request.delete("/api/me");
  expect(deletion.status()).toBe(401);
  expect(deletion.headers()["cache-control"]).toContain("no-store");
  for (const [path, methods] of [
    ["favorites", ["GET", "PUT", "POST", "DELETE"]],
    ["stamps", ["GET", "POST"]],
  ] as const) {
    for (const method of methods) {
      const response = await request.fetch(`/api/me/${path}`, { method });
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(await response.json()).toEqual({ error: "ログインが必要です。" });
    }
  }
});
