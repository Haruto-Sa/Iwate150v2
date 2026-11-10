import { expect, test } from "./fixtures";

// UIの契約検証。認証・削除結果は差し替え、実DBの削除を実行しない。
test.use({ serviceWorkers: "block" });
test("削除確認のキャンセル・失敗・再試行後のログアウトと旧端末保存の保持", async ({ page }, testInfo) => {
  let authenticated = true;
  let fail = true;
  let deletions = 0;
  let signouts = 0;
  await page.addInitScript(() => localStorage.setItem("voja_guest_favorites", "[1]"));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: authenticated
    ? { user: { id: "traveler-A", role: "user" }, expires: "2099-01-01T00:00:00Z" }
    : null }));
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ json: { csrfToken: "test-only" } }));
  await page.route("**/api/auth/signout", (route) => {
    authenticated = false;
    signouts++;
    return route.fulfill({ json: { url: "/account" } });
  });
  await page.route("**/api/me", (route) => {
    expect(route.request().method()).toBe("DELETE");
    expect(route.request().headers()["x-session-user"]).toBe("traveler-A");
    expect(route.request().postDataJSON()).toEqual({ confirmation: "delete" });
    deletions++;
    return route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: "unavailable" } : { success: true } });
  });
  await page.route("**/api/me/favorites**", (route) => route.fulfill({ json: { items: [], nextOffset: null } }));
  await page.goto("/favorites");
  await page.getByRole("link", { name: "保存データを削除", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  const button = page.getByRole("button", { name: "削除してログアウト" });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("元に戻せません");
    expect(dialog.message()).toContain("以前のお気に入りは削除されません");
    await dialog.dismiss();
  });
  await button.click();
  expect(deletions).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await button.click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("削除結果を確認できません。再試行してください。");
  expect(signouts).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("delete-data-retry.png"), fullPage: true });
  fail = false;
  page.once("dialog", (dialog) => dialog.accept());
  await button.click();
  await expect(page.getByRole("main").getByRole("link", { name: "ログイン", exact: true })).toBeVisible();
  expect(deletions).toBe(2);
  expect(signouts).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("voja_guest_favorites"))).toBe("[1]");
  await page.reload();
  await expect(button).toHaveCount(0);
});
