import { expect, test } from "./fixtures";

test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"] as const) {
  test(`${theme}で本人削除の失敗を読み取れ、再試行できる`, async ({ page }, info) => {
    await page.addInitScript(value => localStorage.setItem("voja_color_theme", value), theme);
    await page.route("**/api/auth/session", route => route.fulfill({ json: {
      user: { id: "test-only-user", role: "user" }, expires: "2099-01-01T00:00:00Z",
    } }));
    let attempts = 0;
    await page.route("**/api/me", route => {
      attempts += 1;
      return route.fulfill({ status: 503, json: { error: "test-only" } });
    });
    await page.goto("/account");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    page.on("dialog", dialog => dialog.accept());
    const retry = page.getByRole("button", { name: "削除してログアウト" });
    await retry.click();
    const error = page.getByRole("main").getByRole("alert");
    await expect(error).toHaveText("削除結果を確認できません。再試行してください。");
    const contrast = await error.evaluate(element => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminances = [getComputedStyle(element).color, getComputedStyle(document.body).backgroundColor].map(value => {
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(channel => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      }).sort((a, b) => b - a);
      return (luminances[0] + 0.05) / (luminances[1] + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await info.attach("error-text-contrast", { body: JSON.stringify({ theme, contrast }), contentType: "application/json" });
    await page.screenshot({ path: info.outputPath(`delete-${theme}.png`), fullPage: true });
    await retry.click();
    await expect.poll(() => attempts).toBe(2);
    await expect(retry).toBeEnabled();
  });
}
