import axe from "axe-core";
import { writeFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

const routes = ["/", "/search", "/map", "/camera", "/camera/edit", "/character", "/stamps", "/favorites", "/spots/1", "/login", "/ar", "/offline", "/missing-page"];

for (const theme of ["light", "dark"] as const) {
  for (const route of routes) {
    test(`${route}の${theme}表示をアクセシビリティ検査する`, async ({ page }, info) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(value => {
        localStorage.setItem("voja_color_theme", value);
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      }, theme);
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("main")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (["/spots/1", "/stamps"].includes(route)) {
        await expect(page.getByTitle(route === "/stamps" ? "龍泉洞（対象スポット）" : "盛岡城跡公園", { exact: true })).toBeVisible();
      }
      if (route === "/spots/1") {
        const share = page.getByRole("link", { name: "LINE でシェア", exact: true });
        await share.evaluate(element => element.scrollIntoView({ block: "center" }));
        for (const name of ["X(Twitter) でシェア", "LINE でシェア"]) {
          const bounds = await page.getByRole("link", { name, exact: true }).boundingBox();
          expect(bounds!.height).toBeGreaterThanOrEqual(44);
        }
        const copyBounds = await page.getByRole("button", { name: "URLをコピー", exact: true }).boundingBox();
        expect(copyBounds!.height).toBeGreaterThanOrEqual(44);
      }
      await page.addScriptTag({ content: axe.source });
      const report = await page.evaluate(async () => {
        const result = await (window as unknown as { axe: typeof axe }).axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        });
        return { violations: result.violations, incomplete: result.incomplete, passedRules: result.passes.length,
          contrast: result.passes.find(rule => rule.id === "color-contrast")?.nodes.map(node => ({ target: node.target, checks: node.any.map(check => check.data) })) };
      });
      const path = info.outputPath("accessibility.json");
      await writeFile(path, JSON.stringify(report, null, 2));
      await info.attach("accessibility", { path, contentType: "application/json" });
      expect(report.violations).toEqual([]);
      expect(report.incomplete.filter(rule => rule.id === "aria-prohibited-attr")).toEqual([]);
      if (["/spots/1", "/character", "/missing-page"].includes(route)) {
        if (route === "/character") await page.getByText("キャラクターを選ぶ", { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("contrast.png") });
      }
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`ネイティブ共有の${theme}表示も44pxの操作領域を持つ`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.addInitScript(value => {
      localStorage.setItem("voja_color_theme", value);
      Object.defineProperty(navigator, "share", { configurable: true, value: async () => undefined });
    }, theme);
    await page.goto("/spots/1");
    const share = page.getByRole("button", { name: "シェアする", exact: true });
    await expect(share).toBeVisible();
    const bounds = await share.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  });
}
