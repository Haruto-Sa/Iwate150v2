import { expect, test } from "./fixtures";
import { mockStampCatalog } from "../src/lib/mockData";

// 認証済みUIのテストはsession/本人APIを差し替える。実サーバーの認可はprivate-apiと単体テストで検証。
// 再読込後もPlaywrightのAPI差替えを適用するため、SWはこのUI検証だけ無効化する。
test.use({ serviceWorkers: "block" });
test("ゲストはサンプルを閲覧し、旧保存を残したままログインへ進める", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("voja_guest_favorites", "[2]"),
  );
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/me/favorites"))
      privateRequests.push(request.method());
  });
  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", { name: "お気に入りのサンプル" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "お気に入りのサンプル" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /削除/ })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("favorites-guest.png"),
    fullPage: true,
    animations: "disabled",
  });
  await expect(
    page.getByRole("link", { name: "ログインして保存" }),
  ).toHaveAttribute("href", "/login?next=%2Ffavorites");
  await page.goto("/spots/1");
  await expect(page.getByRole("button", { name: "サンプル（保存対象外）" })).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("voja_guest_favorites")),
  ).toBe("[2]");
  expect(privateRequests).toEqual([]);
});

test("本人の空一覧には自動追加せず、確認した旧保存だけを追加・削除できる", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("voja_guest_favorites", "[1]"),
  );
  await page.route("**/api/stamps/catalog", route => route.fulfill({ json: {
    ...mockStampCatalog, isSample: false, spots: mockStampCatalog.spots.map(spot => ({ ...spot, isSample: false })),
  } }));
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "traveler-A",
          name: "A",
          email: "a@example.test",
          role: "user",
        },
        expires: "2099-01-01T00:00:00Z",
      },
    }),
  );
  let ids: number[] = [];
  const writes: { method: string; body: unknown }[] = [];
  await page.route("**/api/me/favorites**", async (route) => {
    const request = route.request();
    expect(request.headers()["x-session-user"]).toBe("traveler-A");
    const method = request.method();
    if (method !== "GET") writes.push({ method, body: request.postDataJSON() });
    if (method === "POST")
      ids = [...new Set([...ids, ...request.postDataJSON().spotIds])];
    if (method === "PUT")
      ids = [...new Set([...ids, request.postDataJSON().spotId])];
    if (method === "DELETE")
      ids = ids.filter((id) => id !== request.postDataJSON().spotId);
    await route.fulfill({
      json: {
        items: ids.map((spot_id) => ({
          id: spot_id,
          spot_id,
          user_id: 1,
          created_at: "2026-10-16",
        })),
        nextOffset: null,
        persistedSpotIds: ids,
      },
    });
  });
  await page.goto("/favorites");
  await expect(page.getByRole("link", { name: "最初の旅先を探す" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "お気に入りのサンプル" }),
  ).toHaveCount(0);
  const importButton = page.getByRole("button", {
    name: "表示中の1件をこのアカウントに追加",
  });
  await expect(importButton).toBeHidden();
  expect(writes).toEqual([]);
  await page.getByText("追加する内容を確認（1件）").click();
  await expect(page.getByText("盛岡城跡公園", { exact: true })).toBeVisible();
  await importButton.click();
  await expect(page.getByRole("status")).toContainText(
    "1件をこのアカウントに追加",
  );
  expect(writes).toEqual([{ method: "POST", body: { spotIds: [1] } }]);
  expect(
    await page.evaluate(() => localStorage.getItem("voja_guest_favorites")),
  ).toBe("[1]");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("favorites-personal.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "盛岡城跡公園をお気に入りから削除" })
    .click();
  await expect(page.getByRole("link", { name: "最初の旅先を探す" })).toBeVisible();
  expect(writes[1]).toEqual({ method: "DELETE", body: { spotId: 1 } });
  await expect(page.getByText("追加する内容を確認（1件）")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "最初の旅先を探す" })).toBeVisible();
  await expect(page.getByText("追加する内容を確認（1件）")).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(
    await page.evaluate(() => localStorage.getItem("voja_guest_favorites")),
  ).toBe("[1]");
  await page.goto("/spots/3");
  await expect(page.getByRole("button", { name: "サンプル（保存対象外）" })).toBeDisabled();
  expect(writes).toHaveLength(2);

});

test("本人APIが失敗したらサンプルや空表示にせず再取得できる", async ({
  page,
}) => {
  await page.route("**/api/stamps/catalog", route => route.fulfill({ json: {
    ...mockStampCatalog, isSample: false, spots: mockStampCatalog.spots.map(spot => ({ ...spot, isSample: false })),
  } }));
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "traveler-A", role: "user" },
        expires: "2099-01-01T00:00:00Z",
      },
    }),
  );
  let failing = true;
  await page.route("**/api/me/favorites**", (route) =>
    route.fulfill(
      failing
        ? { status: 503, json: { error: "unavailable" } }
        : { json: { items: [], nextOffset: null } },
    ),
  );
  await page.goto("/favorites");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "お気に入りを読み込めませんでした",
  );
  await expect(page.getByRole("link", { name: "最初の旅先を探す" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "お気に入りのサンプル" }),
  ).toHaveCount(0);
  failing = false;
  await page.getByRole("button", { name: "もう一度読み込む" }).click();
  await expect(page.getByRole("link", { name: "最初の旅先を探す" })).toBeVisible();
});

test("公開カタログ障害時はサンプルを本人の保存・移行候補に使わない", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("voja_guest_favorites", "[2]"));
  await page.route("**/api/auth/session", route => route.fulfill({ json: { user: { id: "traveler-A", role: "user" }, expires: "2099-01-01T00:00:00Z" } }));
  const writes: string[] = [];
  await page.route("**/api/me/favorites**", route => {
    if (route.request().method() !== "GET") writes.push(route.request().method());
    return route.fulfill({ json: { items: [{ id: 1, spot_id: 1, user_id: 1 }], nextOffset: null } });
  });
  await page.route("**/api/stamps/catalog", route => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.goto("/favorites");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("お気に入りを読み込めませんでした");
  await expect(page.getByText("盛岡城跡公園", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/追加する内容を確認/)).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("voja_guest_favorites"))).toBe("[2]");
});
