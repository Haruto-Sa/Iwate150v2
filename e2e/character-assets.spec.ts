import type { Page } from "@playwright/test";
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
  expect(await page.getByText("リセット", { exact: true }).evaluate(element => element.getBoundingClientRect().height <= Number.parseFloat(getComputedStyle(element).lineHeight) + 1)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("character-previews.png"), fullPage: true });
});

test("モデル失敗時も別キャラクターへ置換せず再試行できる", async ({ page }) => {
  const requested: string[] = [];
  let failRequests = Promise.resolve();
  await page.route(/\.(?:obj|mtl|fbx)(?:\?|$)/, async route => {
    requested.push(new URL(route.request().url()).pathname);
    await failRequests;
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
  let releaseFailure!: () => void;
  failRequests = new Promise<void>(resolve => { releaseFailure = resolve; });
  try {
    await page.getByRole("button", { name: "再試行", exact: true }).click();
    await expect.poll(() => requested.length).toBeGreaterThan(before);
    await expect(page.getByText("3Dモデルを読み込み中...", { exact: true })).toBeVisible();
  } finally {
    releaseFailure();
  }
  await expect(page.getByText("モデルを表示できませんでした", { exact: true })).toBeVisible();
  await page.unroute(/\.(?:obj|mtl|fbx)(?:\?|$)/);
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByText("モデルを表示できませんでした", { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await readViewerFrame(page)).painted, { timeout: 20000 }).toBeGreaterThan(0.01);
});

test("カリンの画像がモデルより遅れても描画色を変えない", async ({ page }) => {
  const renders: string[] = [];
  for (const imageFirst of [true, false]) {
    let loaded = false;
    let modelReady!: () => void;
    const ready = new Promise<void>(resolve => { modelReady = resolve; });
    const listener = async (message: import("@playwright/test").ConsoleMessage) => {
      if (!message.text().startsWith("[CharacterViewer] candidate load succeeded")) return;
      const info = await message.args()[1]?.jsonValue();
      if (info?.characterId === "karin") { loaded = true; modelReady(); }
    };
    page.on("console", listener);
    await page.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
      Object.defineProperty(HTMLImageElement.prototype, "src", {
        ...descriptor,
        set(value: string) {
          if (value.includes("karin-color.png")) this.addEventListener("load", () => {
            document.documentElement.dataset.karinTextureLoaded = "true";
          }, { once: true });
          descriptor.set!.call(this, value);
        },
      });
    });
    await page.route("**/assets/characters/karin/karin-color.png", async route => {
      const response = await route.fetch();
      if (!imageFirst) await ready;
      await route.fulfill({ response });
    });
    await page.route("**/assets/characters/karin/karin.obj", async route => {
      const response = await route.fetch();
      if (imageFirst) await page.waitForFunction(() => document.documentElement.dataset.karinTextureLoaded === "true");
      await route.fulfill({ response });
    });
    await page.goto("/character");
    await page.getByRole("button", { name: "カリンちゃん 遠野", exact: true }).click();
    await expect.poll(async () => page.getByText("3Dモデルを読み込み中...", { exact: true }).count()).toBe(0);
    await page.waitForFunction(() => document.documentElement.dataset.karinTextureLoaded === "true");
    await expect.poll(() => loaded).toBe(true);
    await expect(page.getByText("モデルを表示できませんでした", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "リセット", exact: true }).click();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const frame = await readViewerFrame(page);
    expect(frame.painted).toBeGreaterThan(0.01);
    renders.push(frame.fingerprint);
    page.off("console", listener);
    await page.unrouteAll({ behavior: "wait" });
  }
  expect(renders[0]).toMatch(/^\d+x\d+:[a-f0-9]{64}$/);
  expect(renders[1]).toBe(renders[0]);
});

/**
 * WebGL描画直後のCanvasからモデル画素と画像を取得する。
 * @param page - ビューアを表示中のページ
 * @returns 背景以外の画素比率と全画素のSHA-256
 * @example const frame = await readViewerFrame(page);
 */
async function readViewerFrame(page: Page) {
  return await page.locator("canvas").evaluate(canvas => new Promise<{ fingerprint: string; painted: number }>((resolve, reject) => requestAnimationFrame(() => {
      const source = canvas as HTMLCanvasElement;
      const copy = document.createElement("canvas");
      copy.width = source.width;
      copy.height = source.height;
      const context = copy.getContext("2d")!;
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
      let painted = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && Math.abs(pixels[index] - 240) + Math.abs(pixels[index + 1] - 242) + Math.abs(pixels[index + 2] - 239) > 40) painted++;
      }
      // 全画素を使った比較は維持し、PNGのエンコード・転送を省く。
      crypto.subtle.digest("SHA-256", pixels).then((digest) => {
        const fingerprint = `${copy.width}x${copy.height}:` + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        resolve({ fingerprint, painted: painted / (copy.width * copy.height) });
      }, reject);
    })));
}

test("全5モデルを表示し拡大・縮小・回転・リセットできる", async ({ page }, info) => {
  test.setTimeout(120_000);
  const loaded = new Map<string, string>();
  page.on("console", async message => {
    if (!message.text().startsWith("[CharacterViewer] candidate load succeeded")) return;
    const result = await message.args()[1]?.jsonValue() as { characterId: string; modelUrl: string } | undefined;
    if (result) loaded.set(result.characterId, result.modelUrl);
  });
  await page.goto("/character");
  for (const character of characters) {
    await page.getByRole("button", { name: `${character.name} ${character.region}`, exact: true }).click();
    const expectedModel = character.model_path?.startsWith("/") ? character.model_path : `/${character.model_path}`;
    await expect.poll(() => loaded.get(character.id), { timeout: 30000 }).toBe(expectedModel);
    await expect(page.getByText("3Dモデルを読み込み中...", { exact: true })).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByText("モデルを表示できませんでした", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "リセット", exact: true }).click();
    await expect.poll(async () => (await readViewerFrame(page)).painted).toBeGreaterThan(0.01);
    const initial = await readViewerFrame(page);
    await page.getByRole("button", { name: "拡大", exact: true }).click();
    await expect.poll(async () => (await readViewerFrame(page)).painted).toBeGreaterThan(initial.painted);
    await page.getByRole("button", { name: "リセット", exact: true }).click();
    await page.getByRole("button", { name: "縮小", exact: true }).click();
    await expect.poll(async () => (await readViewerFrame(page)).painted).toBeLessThan(initial.painted);
    await page.getByRole("button", { name: "回転", exact: true }).click();
    await expect(page.getByRole("button", { name: "停止", exact: true })).toBeVisible();
    const rotating = await readViewerFrame(page);
    await expect.poll(async () => (await readViewerFrame(page)).fingerprint).not.toBe(rotating.fingerprint);
    await page.getByRole("button", { name: "リセット", exact: true }).click();
    await expect(page.getByRole("button", { name: "回転", exact: true })).toBeVisible();
    expect(Math.abs((await readViewerFrame(page)).painted - initial.painted)).toBeLessThan(0.02);
    await page.screenshot({ path: info.outputPath(`viewer-${character.id}.png`), animations: "disabled" });
  }
});
