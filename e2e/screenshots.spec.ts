import { expect, test } from "./fixtures";

const routes = [
  ["/", "home"],
  ["/map", "map"],
  ["/search", "search"],
  ["/camera", "camera"],
  ["/camera/edit", "photo-edit"],
  ["/character", "character"],
  ["/stamps", "stamps"],
  ["/favorites", "favorites"],
  ["/spots/1", "spot-detail"],
  ["/login", "login"],
  ["/ar", "ar"],
  ["/offline", "offline"],
  ["/missing-page", "not-found"],
] as const;

for (const width of [320, 390, 1440]) {
  for (const [path, name] of routes) {
    test(`${name} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.getByRole("main").getByRole("heading").first(),
      ).toBeVisible();
      if (path === "/spots/1") {
        await expect(page.getByTitle("盛岡城跡公園", { exact: true })).toBeVisible();
      }
      // 公開スタンプはデータと地図が揃ってから画面全体を検証する。
      if (path === "/stamps") {
        await expect(
          page.getByTitle("龍泉洞（対象スポット）", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "市町村ごとの対象と進捗" }),
        ).toBeVisible();
      }
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}
