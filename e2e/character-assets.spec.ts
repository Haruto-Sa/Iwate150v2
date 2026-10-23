import { expect, test } from "./fixtures";
import { characters } from "../src/lib/characters";

test.use({ serviceWorkers: "block" });

for (const character of characters) test(`${character.name}のプレビュー・紹介元を320pxで操作できる`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/character");
    const select = page.getByRole("button", { name: `${character.name} ${character.region}`, exact: true });
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    const preview = page.getByRole("img", { name: character.name, exact: true });
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await preview.getAttribute("src")).toContain(encodeURIComponent(character.thumbnail!));
    await page.getByRole("button", { name: "紹介元を見る", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "外部サイトへ移動します" });
    await expect(dialog.getByRole("link", { name: "外部サイトを開く" })).toHaveAttribute("href", character.source_url!);
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("character-previews.png"), fullPage: true });
});

test("モデル失敗時も別キャラクターへ置換せず再試行できる", async ({ page }) => {
  const requested: string[] = [];
  await page.route(/\.(?:obj|mtl|fbx)(?:\?|$)/, route => {
    requested.push(new URL(route.request().url()).pathname);
    return route.abort();
  });
  await page.goto("/character");
  await expect(page.getByText("モデルを表示できませんでした", { exact: true })).toBeVisible({ timeout: 20000 });
  requested.length = 0;
  await page.getByRole("button", { name: "カリンちゃん 遠野", exact: true }).click();
  await expect(page.getByRole("img", { name: "カリンちゃん", exact: true })).toBeVisible();
  await expect(page.getByText("モデルを表示できませんでした", { exact: true })).toBeVisible({ timeout: 20000 });
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.every(path => path.startsWith("/assets/characters/karin/"))).toBe(true);
  const before = requested.length;
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await expect.poll(() => requested.length).toBeGreaterThan(before);
});
