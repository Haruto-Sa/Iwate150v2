import { test as base, expect } from "@playwright/test";

/**
 * 通常の画面テストで既訪問のゲスト状態を共有する。
 * 各テストのBrowserContextはPlaywrightが分離する。オンボーディング専用テストでは標準fixtureを使う。
 * @example test("page", async ({ page }) => { await page.goto("/"); });
 */
export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    const observations = new Set<string>();
    await page.exposeFunction("recordHeaderObservation", (entry: string) => {
      if (observations.size < 100 && entry.length < 500) observations.add(entry);
    });
    await page.addInitScript(() => {
      const reported = new Set<string>();
      document.addEventListener("securitypolicyviolation", (event) => {
        if (event.disposition !== "report") return;
        let resource = event.blockedURI;
        try { resource = new URL(resource).origin; } catch { resource = ["eval", "inline"].includes(resource) ? resource : "other"; }
        const entry = JSON.stringify({ directive: event.effectiveDirective, resource });
        if (reported.has(entry) || reported.size >= 100) return;
        reported.add(entry);
        void (window as unknown as { recordHeaderObservation: (value: string) => Promise<void> }).recordHeaderObservation(entry);
      });
      localStorage.setItem("onboarding_completed", "true");
      for (const path of ["/", "/camera", "/search", "/map", "/stamps", "/character", "/favorites"]) localStorage.setItem(`voja_page_guide:${path}`, "true");
      localStorage.setItem("voja_install_prompt_dismiss_until", String(Date.now() + 86400000));
    });
    await runTest(page);
    await testInfo.attach("header-observations", {
      body: JSON.stringify([...observations].map((entry) => JSON.parse(entry))),
      contentType: "application/json",
    });
  },
});

export { expect };
