import { test as base, expect } from "@playwright/test";

/**
 * 通常の画面テストで既訪問のゲスト状態を共有する。
 * 各テストのBrowserContextはPlaywrightが分離する。オンボーディング専用テストでは標準fixtureを使う。
 * @example test("page", async ({ page }) => { await page.goto("/"); });
 */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_completed", "true");
      for (const path of ["/", "/camera", "/search", "/map", "/stamps", "/character", "/favorites"]) localStorage.setItem(`voja_page_guide:${path}`, "true");
      localStorage.setItem("voja_install_prompt_dismiss_until", String(Date.now() + 86400000));
    });
    await runTest(page);
  },
});

export { expect };
