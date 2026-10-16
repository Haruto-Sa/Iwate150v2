import { expect, test } from "./fixtures";

// ルートごとに新しいcontextを使い、前ページの遷移・SW状態を持ち越さない。
// 同じcontextでの実遷移はnavigation.spec.tsとpwa.spec.tsで別途検証する。
test("guest can access home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("まだ知らない、岩手に会いに。");
});

test("guest can access map without a configured database", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByRole("main").getByRole("heading", { name: "公開スポットはまだありません" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { name: "地図を片手に、岩手を歩く。" })).toBeVisible();
});

test("guest can access search", async ({ page }) => {
  await page.goto("/search");
  const main = page.getByRole("main");
  await expect(main.getByPlaceholder("スポット名、キーワードで検索...")).toBeVisible();
  await expect(main.getByText("旅先のヒント", { exact: true })).toBeVisible();
});

test("guest can access camera", async ({ page }) => {
  await page.goto("/camera");
  await expect(page.getByRole("main").getByText("はじめてでも大丈夫です。")).toBeVisible();
});

test("guest can access stamps", async ({ page }) => {
  await page.goto("/stamps");
  await expect(page.getByRole("main").getByRole("heading", { name: "次に訪れたい場所を、地図から。" })).toBeVisible();
});

test("legacy routes redirect to new public routes", async ({ page }) => {
  await page.goto("/spot?focus=1");
  await expect(page).toHaveURL(/\/map\?focus=1$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "地図を片手に、岩手を歩く。" })).toBeVisible();
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
