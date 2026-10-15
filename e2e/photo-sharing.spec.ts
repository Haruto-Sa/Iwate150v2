import { test, expect } from "./fixtures";

test("カメラ不在でも警告ダイアログを開かず関連ページへ移動できる", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => { throw new DOMException("Requested device not found", "NotFoundError"); },
    });
  });
  await page.goto("/camera");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("カメラが見つかりません");
  await page.getByRole("link", { name: "キャラクターを見る", exact: true }).click();
  await expect(page).toHaveURL(/\/character$/);
  expect(dialogs).toEqual([]);
});


test("撮影画像がない場合はカメラへ戻れる", async ({ page }) => {
  await page.goto("/camera/edit");
  await expect(page.getByRole("link", { name: "写真を撮りに行く" })).toHaveAttribute("href", "/camera");
  await expect(page.getByRole("button", { name: "写真を添付して共有" })).toHaveCount(0);
});

test("最新の編集画像を添付し、縦横比を保ったまま共有する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#d9e9de";
    context.fillRect(0, 0, 800, 600);
    context.fillStyle = "#416557";
    context.fillRect(0, 400, 800, 200);
    sessionStorage.setItem("capturedPhoto", canvas.toDataURL("image/png"));
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        if (!file) throw new Error("Photo missing");
        const bitmap = await createImageBitmap(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        sessionStorage.setItem("lastSharedPhoto", JSON.stringify({
          keys: Object.keys(data), name: file.name, type: file.type,
          width: bitmap.width, height: bitmap.height,
          checksum: Array.from(bytes).reduce((sum, byte, index) => (sum + byte * (index + 1)) % 1_000_000_007, 0),
        }));
        bitmap.close();
      },
    });
  });
  await page.goto("/camera/edit");
  const share = page.getByRole("button", { name: "写真を添付して共有" });
  await expect(share).toBeEnabled();
  await share.click();
  await expect(page.getByRole("status")).toContainText("写真を共有先に渡しました");
  const first = await page.evaluate(() => JSON.parse(sessionStorage.getItem("lastSharedPhoto")!));
  expect(first).toMatchObject({ keys: ["files"], name: "iwate-memory.png", type: "image/png", width: 800, height: 600 });

  await page.getByRole("button", { name: "テキスト", exact: true }).click();
  await page.getByLabel("写真に添える文字").fill("岩手、また来よう。");
  await expect(share).toBeEnabled();
  await page.evaluate(() => sessionStorage.removeItem("lastSharedPhoto"));
  await share.click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("lastSharedPhoto"))).not.toBeNull();
  const second = await page.evaluate(() => JSON.parse(sessionStorage.getItem("lastSharedPhoto")!));
  expect(second.checksum).not.toBe(first.checksum);
  const image = await page.getByRole("img", { name: "撮影した岩手旅の写真" }).boundingBox();
  expect(image!.width / image!.height).toBeCloseTo(4 / 3, 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/photo-edit-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/photo-edit-desktop.png", fullPage: true });
});

test("ファイル共有非対応でもPNGを保存できる", async ({ page }) => {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 400;
    sessionStorage.setItem("capturedPhoto", canvas.toDataURL("image/png"));
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  await page.goto("/camera/edit");
  await expect(page.getByText(/このブラウザでは写真付きの共有/)).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "写真を保存", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("iwate-memory.png");
  expect(await download.failure()).toBeNull();
});
