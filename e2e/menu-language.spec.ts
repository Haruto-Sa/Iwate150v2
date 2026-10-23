import { expect, test } from "@playwright/test";

test("メニュー言語を切り替え、移動と再読み込み後も維持する", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_completed", "true");
      for (const path of ["/", "/camera", "/search", "/map", "/stamps", "/character", "/favorites"]) localStorage.setItem(`voja_page_guide:${path}`, "true");
    localStorage.setItem("voja_install_prompt_dismiss_until", String(Date.now() + 86400000));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "その他", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "メニューの言語 Menu language" }).selectOption("en");
  await expect(dialog).toHaveAccessibleName("More");
  await expect(dialog).toHaveAttribute("lang", "en");
  await dialog.getByRole("button", { name: "Close more menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeFocused();
  // 本文は未翻訳。文書全体を英語と偽らず、翻訳した領域だけlangを設定する。
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await dialog.getByRole("link", { name: "Favorites", exact: true }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await dialog.getByRole("combobox", { name: "メニューの言語 Menu language" }).selectOption("ja");
  await dialog.getByRole("button", { name: "その他を閉じる", exact: true }).click();
  await expect(page.getByRole("button", { name: "その他", exact: true })).toBeFocused();
});

test("初回案内で英語を選び、操作とインストール案内を英語で使える", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "旅のメニュー" });
  await welcome.getByRole("combobox").selectOption("en");
  await expect(page.getByRole("dialog", { name: "Your trip" })).toBeVisible();
  await page.screenshot({ path: `test-results/language-${test.info().project.name}-onboarding.png` });
  await page.getByRole("link", { name: "Find places", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await page.getByRole("dialog", { name: "Using search" }).getByRole("button", { name: "Start searching", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Mobile main pages" }).getByRole("link", { name: "Search", exact: true })).toHaveAttribute("aria-current", "page");
  await page.evaluate(() => localStorage.setItem("voja_install_prompt_visits", "2"));
  await page.reload();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }) });
    window.dispatchEvent(event);
  });
  const install = page.getByRole("dialog", { name: "Add to Home Screen", exact: true });
  await expect(install).toBeVisible();
  await expect(install).toHaveAttribute("lang", "en");
  await install.getByRole("button", { name: "Close Add to Home Screen", exact: true }).click();
  await expect(install).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("別タブの言語変更を反映する", async ({ page, context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("onboarding_completed", "true");
      for (const path of ["/", "/camera", "/search", "/map", "/stamps", "/character", "/favorites"]) localStorage.setItem(`voja_page_guide:${path}`, "true");
    localStorage.setItem("voja_install_prompt_dismiss_until", String(Date.now() + 86400000));
  });
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/search");
  await page.getByRole("button", { name: "その他", exact: true }).click();
  await page.getByRole("combobox", { name: "メニューの言語 Menu language" }).selectOption("en");
  await expect(other.getByRole("button", { name: "More", exact: true })).toBeVisible();
  await other.close();
});
