import { expect, test } from "./fixtures";

test("主要メニューの順序とその他の補助ページ", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/login");
  const primary = page.getByRole("navigation", { name: "主要ページ" });
  await expect(primary.getByRole("link")).toHaveText(["ホーム", "カメラ", "検索", "地図", "スタンプ"]);
  await page.getByRole("button", { name: "その他", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "その他", exact: true });
  await expect(dialog.getByRole("link", { name: /キャラクター/ })).toHaveAttribute("href", "/character");
  await expect(dialog.getByRole("link", { name: /お気に入り/ })).toHaveAttribute("href", "/favorites");
  await expect(dialog.getByRole("link", { name: /Guide|Stamp/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  const visibleNavigation = page.locator("nav:visible");
  await expect(visibleNavigation.getByRole("link")).toHaveText(["ホーム", "カメラ", "検索", "地図", "スタンプ"]);
});

for (const [source, label, destination] of [
  ["/camera", "キャラクターを見る", "/character"],
  ["/search", "お気に入りを見る", "/favorites"],
  ["/map", "お気に入りを見る", "/favorites"],
] as const) {
  test(`${source}から${destination}へ直接移動できる`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(source);
    const shortcut = page.getByRole("link", { name: label, exact: true });
    await expect(shortcut).toBeVisible();
    await expect(shortcut).toHaveAttribute("href", destination);
    await shortcut.click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    if (destination === "/favorites") {
      await expect(page.getByRole("main").getByRole("heading", { name: "ログインすると同期できます" })).toBeVisible();
    } else {
      await expect(page.getByRole("main").getByText("キャラクターを選ぶ", { exact: true })).toBeVisible();
    }
  });
}
