import { expect, test } from "./fixtures";

// Service Workerを無効化して安定させるのではなく、制御開始後の遷移を検証する。
test("production service worker keeps navigation working", async ({ page }) => {
  test.skip(process.env.CI !== "true" && process.env.E2E_SERVER_MODE !== "production", "Service Worker requires a production build");
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto("/map");
  await expect(page.getByRole("main").getByRole("heading", { name: "地図を片手に、岩手を歩く。" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "お気に入りを見る", exact: true }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await page.reload();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "あなただけの旅先リストを" })).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
});
