import { expect, test } from "./fixtures";

// ルートごとに新しいcontextを使い、前ページの遷移・SW状態を持ち越さない。
// 同じcontextでの実遷移はnavigation.spec.tsとpwa.spec.tsで別途検証する。
test("guest can access home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("岩手の旅先");
});

test("guest can access map without a configured database", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByRole("main").getByRole("heading", { name: "公開スポットはまだありません" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { name: "地図", level: 1 })).toBeVisible();
});

test("guest can access search", async ({ page }) => {
  await page.goto("/search");
  const main = page.getByRole("main");
  await expect(main.getByPlaceholder("スポット名、キーワードで検索...")).toBeVisible();
  await expect(main.getByText("旅先のヒント", { exact: true })).toBeVisible();
});

test("イベントを探す導線と再読み込みでイベントタブを開く", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "イベントを探す" }).click();
  await expect(page).toHaveURL(/\/search\?tab=event$/);
  await expect(page.getByRole("button", { name: "イベント", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("もうすぐ開催", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "イベント", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/search?tab=unknown");
  await expect(page.getByRole("button", { name: "スポット", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("guest can access camera", async ({ page }) => {
  await page.goto("/camera");
  await expect(page.getByRole("main").getByRole("heading", { name: "カメラ", level: 1 })).toBeVisible();
});

test("guest can access stamps", async ({ page }) => {
  await page.goto("/stamps");
  await expect(page.getByRole("main").getByRole("heading", { name: "スタンプ", level: 1 })).toBeVisible();
});

test("legacy routes redirect to new public routes", async ({ page }) => {
  await page.goto("/spot?focus=1");
  await expect(page).toHaveURL(/\/map\?focus=1$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "地図", level: 1 })).toBeVisible();
});

test("secret workspace rejects unauthenticated users", async ({ page }) => {
  // Next.jsのstreaming notFoundはHTTP 200でも404画面を返す。
  await page.goto("/studio");
  await expect(page.getByRole("main").getByRole("heading", { name: "ページが見つかりません", exact: true })).toBeVisible();
});

test("guest session endpoint is healthy", async ({ request }) => {
  const response = await request.get("/api/auth/session");
  expect(response.status()).toBe(200);
  expect(await response.json()).toBeNull();
});
