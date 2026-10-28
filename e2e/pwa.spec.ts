import { expect, test } from "./fixtures";

// Service Workerを無効化して安定させるのではなく、制御開始後の遷移を検証する。
test("production service worker keeps navigation working", async ({ page }) => {
  test.skip(process.env.CI !== "true" && process.env.E2E_SERVER_MODE !== "production", "Service Worker requires a production build");
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto("/map");
  await expect(page.getByRole("main").getByText("Map", { exact: true })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "お気に入りを見る", exact: true }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await page.reload();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "ログインすると同期できます" })).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
});

test("本番の画面遷移補助機能が管理画面を直接キャッシュしない", async ({ page }) => {
  test.skip(process.env.CI !== "true" && process.env.E2E_SERVER_MODE !== "production", "Service Worker requires a production build");
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async () => {
    history.pushState(null, "", "/studio?cache-regression=1");
    await (await fetch(location.href)).text();
  });
  // 通常のService Workerとは別にページHTMLを直接保存する補助Workerを起動させない。
  expect(page.workers().filter(worker => new URL(worker.url()).pathname.startsWith("/swe-worker-"))).toHaveLength(0);
  const paths = await page.evaluate(async () => {
    const requests = await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()));
    return requests.flat().map(request => new URL(request.url).pathname);
  });
  expect(paths.some(path => path === "/studio" || path.startsWith("/studio/"))).toBe(false);
});
