import { expect, test } from "@playwright/test";
import { pageGuides } from "../src/lib/pageGuides";

test("7画面の案内を個別に保存し、再表示とEscape後のフォーカスを確認する", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem("voja_install_prompt_dismiss_until", String(Date.now() + 86400000)));
  for (const [path, guide] of Object.entries(pageGuides)) {
    await page.goto(path);
    const dialog = page.getByRole("dialog", { name: guide.ja.title, exact: true });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.matches(":modal"))).toBe(true);
    if (path === "/favorites" || path === "/stamps") await expect(dialog.getByText(/ログイン後/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const trigger = page.getByRole("button", { name: "使い方", exact: true });
    await expect(trigger).toBeFocused();
    await page.reload();
    await expect(trigger).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(path => localStorage.getItem(`voja_page_guide:${path}`), path)).toBe("true");
  }
});

test("英語のページ案内を320px幅で操作できる", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => {
    localStorage.setItem("voja_menu_language", "en");
    localStorage.setItem("voja_install_prompt_dismiss_until", String(Date.now() + 86400000));
  });
  await page.goto("/stamps");
  const dialog = page.getByRole("dialog", { name: "Collecting stamps", exact: true });
  await expect(dialog).toHaveAttribute("lang", "en");
  await expect(dialog.getByText(/Sign in, allow location/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("english-stamp-guide.png") });
  await dialog.getByRole("button", { name: "View stamps", exact: true }).click();
  await expect(page.getByRole("button", { name: "Help", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("ホーム未訪問でも検索案内を閉じた後にPWA案内が出る", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("voja_install_prompt_visits", "2"));
  await page.goto("/search");
  const guide = page.getByRole("dialog", { name: "検索の使い方" });
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "検索を始める" }).click();
  await expect(guide).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("voja_install_prompt_visits"))).toBe("3");
  expect(await page.evaluate(() => localStorage.getItem("onboarding_completed"))).toBeNull();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
    window.dispatchEvent(event);
  });
  await expect(page.getByRole("dialog", { name: "ホーム画面に追加" })).toBeVisible();
});

test("再表示した案内を閉じるまでPWAインストール案内を重ねない", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("voja_page_guide:/search", "true");
    localStorage.setItem("voja_install_prompt_visits", "2");
  });
  await page.goto("/search");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("voja_install_prompt_visits"))).toBe("3");
  await page.getByRole("button", { name: "使い方" }).click();
  const guide = page.getByRole("dialog", { name: "検索の使い方" });
  await expect(guide).toBeVisible();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
    window.dispatchEvent(event);
  });
  await expect(page.getByRole("dialog", { name: "ホーム画面に追加" })).toHaveCount(0);
  await guide.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("dialog", { name: "ホーム画面に追加" })).toBeVisible();
});
