import { expect, test } from "./fixtures";

const routes = ["/", "/search", "/map", "/camera", "/camera/edit", "/character", "/stamps", "/favorites", "/spots/1", "/login", "/ar", "/offline", "/missing-page"];

for (const width of [320, 1440]) {
  for (const route of routes) {
    test(`${route}のキーボード操作が${width}pxで見える`, async ({ page, browserName }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (["/spots/1", "/stamps"].includes(route)) {
        const marker = page.getByTitle(route === "/stamps" ? "龍泉洞（対象スポット）" : "盛岡城跡公園", { exact: true });
        await expect(marker).toBeVisible();
        await expect.poll(() => marker.evaluate(element => !(element instanceof HTMLImageElement) || element.naturalWidth > 0)).toBe(true);
      }
      const samples = [];
      for (let index = 0; index < 12; index += 1) {
        // MacのWebKitはOption+Tabでリンクを含む項目へ移動する。
        await page.keyboard.press(browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab");
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const focus = page.locator(":focus");
        await expect(focus).toBeVisible();
        const sample = await focus.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return {
            tag: element.tagName,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            covering: hit?.tagName + ":" + hit?.getAttribute("class"),
            label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 60),
            outline: style.outlineStyle,
            outlineWidth: parseFloat(style.outlineWidth),
            inViewport: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
            uncovered: !!hit && (element === hit || element.contains(hit)),
            transition: style.transitionDuration,
            animation: style.animationDuration,
          };
        });
        samples.push(sample);
        expect.soft(sample.inViewport, JSON.stringify(sample)).toBe(true);
        expect.soft(sample.uncovered, JSON.stringify(sample)).toBe(true);
        expect.soft(sample.outline, JSON.stringify(sample)).not.toBe("none");
        expect.soft(sample.outlineWidth, JSON.stringify(sample)).toBeGreaterThanOrEqual(2);
        for (const duration of `${sample.transition},${sample.animation}`.split(",")) {
          expect.soft(parseFloat(duration), JSON.stringify(sample)).toBeLessThanOrEqual(0.00001);
        }
      }
      await info.attach("keyboard-focus", { body: JSON.stringify(samples), contentType: "application/json" });
    });
  }
}
