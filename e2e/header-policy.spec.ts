import { expect, test } from "./fixtures";

test("配信ポリシー候補はブラウザー内で観測でき、現行の処理を遮断しない", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      if (event.disposition === "report" && event.blockedURI === "eval") {
        document.documentElement.dataset.observedEvalPolicy = event.effectiveDirective;
      }
    });
  });
  await page.route("**/search", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace("</head>", '<script>document.documentElement.dataset.observedEvalResult = String(new Function("return 3")());</script></head>') });
  });
  const response = await page.goto("/search");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("'unsafe-eval'");
  const observed = headers["content-security-policy-report-only"];
  expect(observed).toContain("'wasm-unsafe-eval'");
  expect(observed).not.toContain("'unsafe-eval'");
  expect(observed).not.toContain("report-uri");
  expect(headers["reporting-endpoints"]).toBeUndefined();
  expect(observed).toContain("report-to iwate-header-observation");
  // Report-Onlyの観測と、実行を妨げない性質を同時に確認する。
  await expect(page.locator("html")).toHaveAttribute("data-observed-eval-result", "3");
  await expect.poll(() => page.locator("html").getAttribute("data-observed-eval-policy")).toBe("script-src");
  await expect(page.getByPlaceholder("スポット名、キーワードで検索...")).toBeEnabled();
});
