import { expect, test } from "./fixtures";

test("検索結果に対象施設の年度・入込数・出典を表示し、未掲載はゼロにしない", async ({ page }, testInfo) => {
  await page.goto("/search");
  const keyword = page.getByRole("textbox", { name: "スポット・イベントのキーワード" });
  await keyword.fill("龍泉洞");
  await expect(page.getByRole("article")).toHaveCount(1);
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "龍泉洞", exact: true }) });
  await expect(card.getByText("2022年度 観光客入込数", { exact: true })).toBeVisible();
  await expect(card.getByText("145,201人", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: /出典 岩泉町統計書/ })).toHaveAttribute("href", "https://www.town.iwaizumi.lg.jp/docs/2024052000014/file_contents/07.pdf#page=3");
  await page.screenshot({ path: testInfo.outputPath("ryusendo-statistic.png"), fullPage: true });
  await keyword.fill("中尊寺");
  const other = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "中尊寺 金色堂", exact: true }) });
  await expect(other).toBeVisible();
  await expect(other.getByText(/観光客入込数|0人|出典/)).toHaveCount(0);
});

test("操作の準備前は検索条件を変更させず、準備後の入力を検索へ反映する", async ({ page }) => {
  let release!: () => void;
  let scriptsHeld = false;
  const scriptsReady = new Promise<void>(resolve => { release = resolve; });
  // hydrationを保留し、ストリーミング用の非表示領域も含めてSSRの無効化を検証する。
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async route => { scriptsHeld = true; await scriptsReady; await route.continue(); });
  try {
    await page.goto("/search", { waitUntil: "commit" });
    await expect.poll(() => scriptsHeld).toBe(true);
    const input = page.getByLabel("スポット・イベントのキーワード", { exact: true });
    await expect(input).toBeDisabled();
    const filters = page.locator("fieldset select");
    await expect(filters).toHaveCount(2);
    for (const filter of await filters.all()) await expect(filter).toBeDisabled();
    release();
    const readyInput = page.getByRole("textbox", { name: "スポット・イベントのキーワード" });
    await expect(readyInput).toBeVisible();
    await expect(readyInput).toBeEnabled();
    await readyInput.fill("龍泉洞");
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "龍泉洞", exact: true })).toBeVisible();
  } finally { release(); }
});


test("歴史文化館に施設入場者数の年度・単位・公式出典を表示する", async ({ page }, testInfo) => {
  await page.goto("/search");
  await page.getByRole("textbox", { name: "スポット・イベントのキーワード" }).fill("もりおか歴史文化館");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "もりおか歴史文化館", exact: true }) });
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(card.getByText("2024年度 入場者数", { exact: true })).toBeVisible();
  await expect(card.getByText("249,188人", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: /出典 盛岡市統計書/ })).toHaveAttribute("href", "https://www.city.morioka.iwate.jp/_res/projects/default_project/_page_/001/039/501/R6_shiminnoseikatsu.pdf#page=1");
  await expect(card.getByText("観光客入込数", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("morioka-statistic.png"), fullPage: true });
});


test("編集おすすめを来訪統計と区別して表示する", async ({ page }, testInfo) => {
  await page.goto("/search");
  const keyword = page.getByRole("textbox", { name: "スポット・イベントのキーワード" });
  for (const name of ["御所野遺跡", "鉄の歴史館", "奥州宇宙遊学館"]) {
    await keyword.fill(name);
    await expect(page.getByRole("article")).toHaveCount(1);
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(card.getByText("編集おすすめ", { exact: true })).toBeVisible();
    await expect(card.getByText(/観光客入込数|入場者数|0人/)).toHaveCount(0);
  }
  await page.getByRole("article").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("editorial-pick.png") });
  await keyword.fill("龍泉洞");
  await expect(page.getByRole("heading", { name: "龍泉洞", exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").getByText("編集おすすめ", { exact: true })).toHaveCount(0);
  await expect(page.getByText("145,201人", { exact: true })).toBeVisible();
});
