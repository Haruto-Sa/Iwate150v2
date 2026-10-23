import type { Page, TestInfo } from "@playwright/test";
import { test as base, expect } from "./fixtures";

const test = base.extend({
  launchOptions: async ({ browserName }, runWithOptions) => {
    await runWithOptions({ args: browserName === "chromium" ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--enable-unsafe-swiftshader"] : [] });
  },
});

test.use({ permissions: ["camera"] });

const faceErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  faceErrors.length = 0;
  page.on("console", (message) => {
    if (message.text().startsWith("faceMesh onFrame error") && faceErrors.length < 4) {
      faceErrors.push(message.text().slice(0, 768));
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
  console.error("Camera inference diagnostics:", faceErrors);
  const diagnostics = await page.evaluate(() => {
    const video = document.querySelector("video");
    return {
      marks: performance.getEntriesByType("mark").filter((mark) => mark.name.startsWith("iwate-camera:")).map((mark) => ({ name: mark.name, time: mark.startTime })),
      video: video ? { readyState: video.readyState, currentTime: video.currentTime, paused: video.paused, width: video.videoWidth } : null,
    };
  }).catch(() => ({ unavailable: true }));
  await testInfo.attach("camera-diagnostics", { body: JSON.stringify(diagnostics, null, 2), contentType: "application/json" });
});


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
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
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
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  await page.getByRole("button", { name: "3秒", exact: true }).click();
  await shutter.click();
  await page.getByRole("button", { name: "カメラ切替" }).click();
  // 再起動中は映像の準備に使うタイマーも通常どおり進める。
  await page.clock.resume();
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await page.clock.fastForward(3500);
  await expect(page).toHaveURL(/\/camera$/);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60000));
  await shutter.click();
  await page.evaluate(() => {
    const video = document.querySelector("video")!;
    const track = (video.srcObject as MediaStream).getVideoTracks()[0];
    track.stop();
    track.dispatchEvent(new Event("ended"));
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("カメラが停止しました");
  await page.clock.fastForward(3500);
  await expect(page).toHaveURL(/\/camera$/);
  await expect(shutter).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("capturedPhoto"))).toBeNull();
});

test("キャラクター変更と画面離脱で予約を取り消す", async ({ page }) => {
  await page.goto("/camera");
  const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
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
    // 画面保存の所要時間によって撮影予約が満了しないようにする。
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
    await page.getByRole("button", { name: "10秒", exact: true }).click();
    await page.locator("video").scrollIntoViewIfNeeded();
    await shutter.click();
    const cancel = page.getByRole("button", { name: "タイマーを取り消す" });
    await expect(cancel).toBeVisible();
    const previewWidth = await page.locator("video").evaluate((video) => ({
      width: video.getBoundingClientRect().width,
      available: video.parentElement!.parentElement!.getBoundingClientRect().width,
    }));
    expect(previewWidth.width).toBeGreaterThan(previewWidth.available - 4);
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
  test("WorkerでWebGLを使えない場合も既存の顔検出で撮影できる", async ({ page }) => {
    test.setTimeout(45000);
    await page.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
    await page.route("**/mediapipe/face_mesh/worker-context.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: "self.initializeFaceWorkerContext = () => { throw new DOMException('Worker WebGL is unavailable', 'NotSupportedError'); };",
    }));
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await page.getByRole("button", { name: "そばっち", exact: true }).click();
    // native初回推論中はmain threadが止まり、開始markのpoll自体も返らない。
    // 初期化・モデル準備・推論を含むUIの復帰を一つの期限で検証する。
    await expect(page.getByRole("status").filter({ hasText: "顔をカメラに向ける" })).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => performance.getEntriesByName("iwate-camera:face:worker-unavailable").length)).toBe(1);
    await expect(shutter).toBeDisabled();
    await page.getByRole("button", { name: "キャラクターを外す", exact: true }).click();
    await shutter.click();
    await expect(page).toHaveURL(/\/camera\/edit$/);
  });

  test("顔検出の停止中も操作でき、期限切れ後に通常撮影できる", async ({ page }) => {
    test.setTimeout(45000);
    await page.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
    await page.route("**/mediapipe/face_mesh/worker.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: "self.onmessage = ({data}) => { if (data.type === 'init') self.postMessage({type:'ready'}); else data.image.close(); };",
    }));
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await page.getByRole("button", { name: "そばっち", exact: true }).click();
    await page.waitForFunction(() => performance.getEntriesByName("iwate-camera:face:first-send").length > 0);
    await expect(shutter).toBeDisabled();
    await page.getByRole("button", { name: "キャラクターを外す", exact: true }).click();
    await expect(shutter).toBeEnabled();
    await page.getByRole("button", { name: "そばっち", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "顔検出を開始できませんでした" })).toBeVisible({ timeout: 25000 });
    await page.unroute("**/mediapipe/face_mesh/worker.js");
    await page.getByRole("button", { name: "読み込み直す", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "顔をカメラに向ける" })).toBeVisible({ timeout: 15000 });
    await expect(shutter).toBeDisabled();
    await page.getByRole("button", { name: "キャラクターを外す", exact: true }).click();
    await shutter.click();
    await expect(page).toHaveURL(/\/camera\/edit$/);
  });

  test("モデル通信の停止は20秒で再試行できる状態になる", async ({ page }) => {
    test.setTimeout(45000);
    await page.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
    let requested = false;
    await page.route("**/models/wanko1.obj", () => { requested = true; });
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
    await page.getByRole("button", { name: "そばっち", exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await page.clock.fastForward(20000);
    await expect(page.getByRole("alert").filter({ hasText: "そばっちを読み込めませんでした" })).toBeVisible();
    await expect(page.getByRole("button", { name: "読み込み直す", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "キャラクターを外す", exact: true }).click();
    await expect(shutter).toBeEnabled();
  });

  test("選択解除と離脱でモデルの通信を中止する", async ({ page }) => {
    await page.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
    let requested = 0;
    let cancelled = 0;
    page.on("requestfailed", (request) => { if (request.url().endsWith("/models/wanko1.obj")) cancelled += 1; });
    await page.route("**/models/wanko1.obj", () => { requested += 1; });
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await page.getByRole("button", { name: "そばっち", exact: true }).click();
    await expect.poll(() => requested).toBe(1);
    await page.getByRole("button", { name: "キャラクターを外す", exact: true }).click();
    await expect.poll(() => cancelled).toBe(1);
    await expect(shutter).toBeEnabled();
    await page.getByRole("button", { name: "そばっち", exact: true }).click();
    await expect.poll(() => requested).toBe(2);
    await page.getByRole("link", { name: "ホーム", exact: true }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => cancelled).toBe(2);
  });

  test("モデルの読込失敗を再試行し、選択解除で撮影できる", async ({ page }) => {
    await page.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
    await page.route("**/models/wanko1.obj", (route) => route.fulfill({ status: 503, body: "Model unavailable" }));
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    const character = page.getByRole("button", { name: "そばっち", exact: true });
    await character.click();
    await expect(page.getByRole("alert").filter({ hasText: "そばっちを読み込めませんでした" })).toBeVisible({ timeout: 15000 });
    await expect(shutter).toBeDisabled();
    await page.unroute("**/models/wanko1.obj");
    const retry = page.getByRole("button", { name: "読み込み直す", exact: true });
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await retry.click();
    await expect(page.getByRole("status").filter({ hasText: "顔をカメラに向ける" })).toBeVisible({ timeout: 15000 });
    await expect(shutter).toBeDisabled();
    await page.getByRole("button", { name: "キャラクターを外す", exact: true }).click();
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await shutter.click();
    await expect(page).toHaveURL(/\/camera\/edit$/);
  });
});

test("顔が映らない間はキャラクターなしの誤撮影を防ぎ、選択解除で撮影できる", async ({ page }, testInfo) => {
  await page.goto("/camera");
  const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "そばっち", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "顔をカメラに向ける" })).toBeVisible({ timeout: 15000 });
  await expect(shutter).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("capturedPhoto"))).toBeNull();
  expect((await page.getByRole("button", { name: "キャラクターを外す", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath("camera-face-required.png"), fullPage: true });
  await page.getByRole("button", { name: "キャラクターを外す", exact: true }).click();
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(page).toHaveURL(/\/camera\/edit$/);
});



/**
 * ブラウザの録画APIと形式を記録し、非対応環境では写真への復帰を検証する。
 * @param page - カメラ画面を表示したページ
 * @param testInfo - 対応状況を保存するテスト情報
 * @returns 録画対応時は継続、非対応時は写真撮影を確認して録画部分をskip
 * @example await requireRecordingSupport(page, testInfo);
 */
async function requireRecordingSupport(page: Page, testInfo: TestInfo): Promise<void> {
  const capability = await page.evaluate(() => ({
    recorder: typeof MediaRecorder !== "undefined",
    captureStream: typeof HTMLCanvasElement.prototype.captureStream === "function",
    formats: ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
      .map((mime) => ({ mime, supported: typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime) })),
  }));
  await testInfo.attach("recording-capability", { body: JSON.stringify(capability, null, 2), contentType: "application/json" });
  const supported = capability.recorder && capability.captureStream && capability.formats.some((format) => format.supported);
  if (!supported) {
    await expect(page.getByRole("button", { name: "動画", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "写真を撮る", exact: true }).click();
    await expect(page).toHaveURL(/\/camera\/edit$/);
    await expect(page.getByRole("img", { name: "撮影した岩手旅の写真" })).toBeVisible();
    test.skip(true, `録画API/形式非対応。写真撮影成功: ${JSON.stringify(capability)}`);
  }
}


test("動画を録画・再生・保存し、写真撮影に戻れる", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("voja_color_theme", "dark");
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      const file = data.files![0];
      sessionStorage.setItem("sharedVideo", JSON.stringify({name:file.name, type:file.type, size:file.size}));
    } });
  });
  await page.goto("/camera");
  await expect(page.getByRole("button", { name: "写真を撮る", exact: true })).toBeEnabled({ timeout: 15000 });
  await requireRecordingSupport(page, testInfo);
  await page.getByRole("button", { name: "動画", exact: true }).click();
  await expect(page.getByRole("group", { name: "撮影タイマー" })).toHaveCount(0);
  await page.getByRole("button", { name: "録画を開始", exact: true }).click();
  await expect(page.getByRole("button", { name: "写真", exact: true })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "1秒 / 10秒" })).toBeVisible();
  const stop = page.getByRole("button", { name: "録画を停止", exact: true });
  await expect(stop.locator("svg")).toHaveCSS("color", "rgb(255, 200, 196)");
  await page.screenshot({ path: testInfo.outputPath("video-dark-recording.png"), animations: "disabled" });
  await stop.click();
  const preview = page.getByLabel("撮影した動画", { exact: true });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  const info = await preview.evaluate(async (element) => {
    const video = element as HTMLVideoElement;
    video.muted = true;
    const done = new Promise<void>((resolve, reject) => { video.onended = () => resolve(); video.onerror = () => reject(new Error("Playback failed")); });
    await video.play(); await done;
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  });
  expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(720);
  expect(info.duration).toBeGreaterThan(0.5);
  expect(info.duration).toBeLessThanOrEqual(11);
  expect(await page.evaluate(() => performance.getEntriesByName("iwate-camera:face:first-send").length)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("video-preview.png"), fullPage: true });
  await page.getByRole("button", { name: "動画を共有", exact: true }).click();
  const shared = await page.evaluate(() => JSON.parse(sessionStorage.getItem("sharedVideo")!));
  expect(shared.name).toMatch(/iwate-trip\.(mp4|webm)$/);
  expect(shared.type).toMatch(/^video\//);
  expect(shared.size).toBeGreaterThan(0);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "動画を保存" }).click();
  expect((await download).suggestedFilename()).toMatch(/iwate-trip\.(mp4|webm)$/);
  await page.getByRole("button", { name: "撮影に戻る" }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "写真", exact: true }).click();
  await expect(page.getByRole("button", { name: "写真を撮る", exact: true })).toBeEnabled({ timeout: 15000 });
  await page.getByRole("button", { name: "写真を撮る", exact: true }).click();
  await expect(page).toHaveURL(/\/camera\/edit$/);
});

test("バックグラウンド移行で未完成の動画を破棄し、再録画できる", async ({ page }, testInfo) => {
  await page.goto("/camera");
  await expect(page.getByRole("button", { name: "写真を撮る", exact: true })).toBeEnabled({ timeout: 15000 });
  await requireRecordingSupport(page, testInfo);
  await page.getByRole("button", { name: "動画", exact: true }).click();
  await page.getByRole("button", { name: "録画を開始", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("録画を中断しました");
  await expect(page.getByLabel("撮影した動画", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "録画を開始", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "録画を開始", exact: true }).click();
  await expect(page.getByRole("button", { name: "録画を停止", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "ホーム", exact: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test("録画非対応でも写真撮影を利用できる", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "MediaRecorder"); });
  await page.goto("/camera");
  await expect(page.getByRole("button", { name: "写真を撮る", exact: true })).toBeEnabled({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "動画", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "写真を撮る", exact: true }).click();
  await expect(page).toHaveURL(/\/camera\/edit$/);
});

test.describe("モデル配置の余白", () => {
  test.use({ serviceWorkers: "block" });
  test("余白がない間は撮影を止め、顔が小さくなるとモデル付きで撮影できる", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        /**
         * 検証用の顔矩形を切り替えるWorker参照だけを保持する。
         * @param url - Worker URL
         * @param options - Worker設定
         * @example new Worker(url);
         */
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          Object.assign(window, { layoutTestWorker: this });
        }
      };
    });
    await page.route("**/mediapipe/face_mesh/worker.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `let face = [[0,0],[1,1]];
        self.onmessage = ({data}) => {
          if (data.type === 'init') self.postMessage({type:'ready'});
          else if (data.type === 'resize-fixture') face = [[0.35,0.2],[0.65,0.6]];
          else { data.image.close(); self.postMessage({type:'result',multiFaceLandmarks:[face.map(([x,y])=>({x,y,z:0}))]}); }
        };`,
    }));
    await page.goto("/camera");
    const shutter = page.getByRole("button", { name: "写真を撮る", exact: true });
    await expect(shutter).toBeEnabled({ timeout: 15000 });
    await page.getByRole("button", { name: "そばっち", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "少し離れる" })).toBeVisible({ timeout: 15000 });
    await expect(shutter).toBeDisabled();
    await page.evaluate(() => (window as unknown as { layoutTestWorker: Worker }).layoutTestWorker.postMessage({ type: "resize-fixture" }));
    await expect(shutter).toBeEnabled();
    await shutter.click();
    await expect(page).toHaveURL(/\/camera\/edit$/);
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("capturedModels")!))).toEqual(["sobacchi"]);
    await expect(page.getByRole("img", { name: "撮影した岩手旅の写真" })).toBeVisible();
  });
});
