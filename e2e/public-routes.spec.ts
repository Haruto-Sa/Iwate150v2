import { expect, test } from "@playwright/test";

test("guest can access main public routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /VOJA IWATE/i })).toBeVisible();

  await page.goto("/map");
  await expect(page.getByText("Map").first()).toBeVisible();

  await page.goto("/search");
  await expect(page.getByPlaceholder("スポット名やイベント名で検索")).toBeVisible();

  await page.goto("/camera");
  await expect(page.getByText("はじめてでも大丈夫です。")).toBeVisible();
});

test("legacy routes redirect to new public routes", async ({ page }) => {
  await page.goto("/spot?focus=1");
  await expect(page).toHaveURL(/\/map\?focus=1$/);
});

test("secret workspace redirects unauthenticated users", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByText(/This page could not be found\.|404/i).first()).toBeVisible();
});
