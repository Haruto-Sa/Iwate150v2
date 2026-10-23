import { test as base, expect } from "./fixtures";

const test = base.extend({
  launchOptions: async ({ browserName }, runWithOptions) => {
    await runWithOptions({ args: browserName === "chromium" ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--enable-unsafe-swiftshader"] : [] });
  },
});

test.use({ permissions: ["camera"] });

test("カメラ映像を撮影して編集・PNG保存へ進める", async ({ page }) => {
  await page.goto("/camera");
  const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await shutter.click();
  await expect(page).toHaveURL(/\/camera\/edit$/);
  await expect(page.getByRole("img", { name: "撮影した岩手旅の写真" })).toBeVisible();
  await expect(page.getByRole("link", { name: "写真を保存", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("capturedPhoto")?.startsWith("data:image/png;base64,"))).toBe(true);
});

test("3秒後に撮影し、10秒予約は取り消せる", async ({ page }) => {
  await page.goto("/camera");
  const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
  await expect(shutter).toHaveCount(1);
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await page.clock.install();
  await page.getByRole("button", { name: "10秒", exact: true }).click();
  await shutter.click();
  await expect(page.getByRole("status", { name: "10秒後に撮影" })).toBeVisible();
  await page.getByRole("button", { name: "タイマーを取り消す" }).click();
  await page.clock.fastForward(11000);
  await expect(page).toHaveURL(/\/camera$/);
  expect(await page.evaluate(() => sessionStorage.getItem("capturedPhoto"))).toBeNull();
  await page.getByRole("button", { name: "3秒", exact: true }).click();
  await expect(page.getByRole("button", { name: "3秒", exact: true })).toHaveAttribute("aria-pressed", "true");
  await shutter.click();
  await page.clock.fastForward(2000);
  await expect(page.getByRole("status", { name: "1秒後に撮影" })).toBeVisible();
  await expect(page).toHaveURL(/\/camera$/);
  await page.clock.fastForward(1000);
  await expect(page).toHaveURL(/\/camera\/edit$/);
  await expect(page.getByRole("img", { name: "撮影した岩手旅の写真" })).toBeVisible();
});

test("カメラ切替と映像の終了で予約を取り消す", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/camera");
  const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "3秒", exact: true }).click();
  await shutter.click();
  await page.getByRole("button", { name: "カメラ切替" }).click();
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await page.waitForTimeout(3500);
  await expect(page).toHaveURL(/\/camera$/);
  await shutter.click();
  await page.evaluate(() => {
    const video = document.querySelector("video")!;
    const track = (video.srcObject as MediaStream).getVideoTracks()[0];
    track.stop();
    track.dispatchEvent(new Event("ended"));
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("カメラが停止しました");
  await page.waitForTimeout(3500);
  await expect(page).toHaveURL(/\/camera$/);
  await expect(shutter).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("capturedPhoto"))).toBeNull();
});

test("キャラクター変更と画面離脱で予約を取り消す", async ({ page }) => {
  await page.goto("/camera");
  const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await page.clock.install();
  await page.getByRole("button", { name: "10秒", exact: true }).click();
  await shutter.click();
  const character = page.getByRole("button", { name: "そばっち", exact: true });
  await character.click();
  await expect(page.getByRole("button", { name: "タイマーを取り消す" })).toHaveCount(0);
  await character.click();
  await page.clock.fastForward(11000);
  await expect(page).toHaveURL(/\/camera$/);
  await shutter.click();
  await page.getByRole("link", { name: "キャラクターを見る" }).click();
  await page.clock.fastForward(11000);
  await expect(page).toHaveURL(/\/character$/);
  expect(await page.evaluate(() => sessionStorage.getItem("capturedPhoto"))).toBeNull();
});

for (const [width, height] of [[390, 844], [844, 390]]) {
  test(`撮影操作が${width}x${height}でナビに重ならない`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await page.getByRole("button", { name: "10秒", exact: true }).click();
    await page.locator("video").scrollIntoViewIfNeeded();
    await shutter.click();
    const cancel = page.getByRole("button", { name: "タイマーを取り消す" });
    await expect(cancel).toBeVisible();
    const countdown = await page.getByRole("status", { name: /秒後に撮影$/ }).locator("span").boundingBox();
    const header = await page.getByRole("banner").boundingBox();
    expect(countdown!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    expect(countdown!.y + countdown!.height).toBeLessThanOrEqual(height);
    const box = await cancel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await cancel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return top !== null && el.contains(top);
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`camera-timer-${width}x${height}.png`), fullPage: true });
    await cancel.click();
    await expect(shutter).toBeEnabled({ timeout: 15000 });
  });
}

test.describe("モデルの通信障害", () => {
  // 通常の撮影/PWAはSW有効。HTTP障害注入のみSW非対応環境で検証する。
  test.use({ serviceWorkers: "block" });
  test("モデルの読込失敗中は撮影せず、選択解除で復帰できる", async ({ page }) => {
    await page.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
    await page.route("**/models/wanko1.obj", (route) => route.fulfill({ status: 503, body: "Model unavailable" }));
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    const character = page.getByRole("button", { name: "そばっち", exact: true });
    await character.click();
    await expect(page.getByText(/一部のガイドを表示できませんでした/)).toBeVisible();
    await expect(shutter).toBeDisabled();
    await character.click();
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await shutter.click();
    await expect(page).toHaveURL(/\/camera\/edit$/);
  });
});
