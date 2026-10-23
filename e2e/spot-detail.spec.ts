import { expect, test } from "./fixtures";


test("所在地・保存・共有を表示し、現在地を要求せずルートを確認する", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      value: () => { throw new Error("所在地表示で現在地を取得しない"); },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/spots/1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("盛岡城跡公園");
  await expect(page.getByTitle("盛岡城跡公園", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "ログインして保存" })).toBeVisible();
  await expect(page.getByRole("link", { name: "地図を広げる" })).toHaveAttribute("href", "/map?focus=1");
  await page.getByRole("button", { name: "ルート検索", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "外部サイトへ移動します" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "外部サイトを開く" })).toHaveAttribute("href", /destination=39\.70/);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe("地図の通信障害", () => {
  // SWキャッシュで障害注入を迂回しない。SWはpwa.specで別途検証。
  test.use({ serviceWorkers: "block" });
test("タイル障害時も所在地の代替操作を利用できる", async ({ page }) => {
  // 登録APIだけを遮断するとSerwistの登録が中途半端になるため、非対応環境として検証する。
  await page.addInitScript(() => { delete (Navigator.prototype as Partial<Navigator>).serviceWorker; });
  await page.route("**/*.tile.openstreetmap.org/**", (route) => route.fulfill({ status: 503, contentType: "text/plain", body: "Tile unavailable" }));
  await page.goto("/spots/1");
  await expect(page.getByRole("status").filter({ hasText: "地図を読み込めません" })).toBeVisible();
  await page.getByRole("button", { name: "ルート検索", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

});

for (const width of [320, 390, 844, 1440]) {
  test(`詳細の操作と地図が${width}pxで収まる`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await page.goto("/spots/1");
    await expect(page.getByTitle("盛岡城跡公園", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "ルート検索", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`detail-${width}.png`), fullPage: true });
  });
}


test("所在地上のホイール操作でもページをスクロールできる", async ({ page, isMobile }) => {
  test.skip(isMobile, "モバイルのスワイプは実機検証対象。ここではデスクトップのホイールを検証する。");
  await page.goto("/spots/1");
  const map = page.locator(".leaflet-container");
  await expect(page.getByTitle("盛岡城跡公園", { exact: true })).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  await map.hover();
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});
