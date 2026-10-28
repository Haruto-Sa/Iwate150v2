import { test, expect } from "./fixtures";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

test("カメラ映像を撮影して編集・PNG保存へ進める", async ({ page }) => {
  await page.goto("/camera");
  const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(page).toHaveURL(/\/camera\/edit$/);
  await expect(page.getByRole("img", { name: "撮影した岩手旅の写真" })).toBeVisible();
  await expect(page.getByRole("link", { name: "写真を保存", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("capturedPhoto")?.startsWith("data:image/png;base64,"))).toBe(true);
});
