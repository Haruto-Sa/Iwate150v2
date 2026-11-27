import { expect, test } from "./fixtures";
import officialSpots from "../src/data/official-spots.json";

for (const spot of officialSpots) test(`${spot.name}を地域とジャンルで絞り込み、写真を流用せず詳細へ進む`, async ({ page }, info) => {
  await page.goto("/search");
  await page.getByRole("combobox", { name: "市区町村", exact: true }).selectOption(String(spot.mockCityId));
  await page.getByRole("combobox", { name: "ジャンル", exact: true }).selectOption(String(spot.mockGenreId));
  await page.getByRole("textbox", { name: "スポット・イベントのキーワード" }).fill(spot.name);
  await expect(page.getByRole("article")).toHaveCount(1);
  const card = page.getByRole("article");
  await expect(card.getByRole("heading", { name: spot.name, exact: true })).toBeVisible();
  await expect(card.locator("img")).toHaveCount(0);
  await card.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/spots/${spot.mockId}$`));
  await expect(page.getByRole("heading", { name: spot.name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "関連サイトを見る", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "外部サイトへ移動します" });
  await expect(dialog.getByRole("link", { name: "外部サイトを開く" })).toHaveAttribute("href", spot.referenceUrl);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByRole("button", { name: "サンプル（保存対象外）" })).toBeDisabled();
  const share = page.getByRole("link", { name: "X(Twitter) でシェア" });
  if (await share.count()) expect(new URL((await share.getAttribute("href"))!).searchParams.get("text")).toContain(spot.referenceUrl);
  await expect(page.getByTitle(spot.name, { exact: true })).toBeVisible();
  // 地図画像以外に別施設の写真を表示しない。
  expect(await page.getByRole("main").locator("img").evaluateAll(images => images.every(image => Boolean(image.closest(".leaflet-container"))))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText("写真準備中", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`official-${spot.mockId}.png`), fullPage: true });
});
