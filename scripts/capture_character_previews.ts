import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { characters } from "../src/lib/characters";

/**
 * ローカルCharacter画面の実モデルを描画し、紹介用PNGを再生成する。
 * @returns なし。モデル不一致・読み込み失敗は非ゼロで終了する
 * @example bun run scripts/capture_character_previews.ts http://127.0.0.1:3104
 */
async function capturePreviews(): Promise<void> {
  const base = new URL(process.argv[2] ?? "http://127.0.0.1:3104");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Use a local preview server");
  const browser = await chromium.launch();
  const deadline = setTimeout(() => { void browser.close(); }, 180_000);
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 900 }, deviceScaleFactor: 2 });
    page.setDefaultTimeout(30_000);
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_completed", "true");
      localStorage.setItem("voja_install_prompt_dismiss_until", String(Date.now() + 86400000));
    });
    const loaded = new Map<string, string>();
    page.on("console", async message => {
      if (!message.text().startsWith("[CharacterViewer] candidate load succeeded")) return;
      const info = await message.args()[1]?.jsonValue() as { characterId: string; modelUrl: string };
      if (info) loaded.set(info.characterId, info.modelUrl);
    });
    await mkdir("public/assets/characters/previews", { recursive: true });
    await page.goto(new URL("/character", base).href);
    for (const character of characters) {
      await page.getByRole("button", { name: `${character.name} ${character.region}`, exact: true }).click();
      await expect.poll(() => loaded.get(character.id), { timeout: 30_000 }).toBe(character.model_path?.startsWith("/") ? character.model_path : `/${character.model_path}`);
      await expect(page.getByText("3Dモデルを読み込み中...", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "リセット", exact: true }).click();
      const controls = page.getByRole("button", { name: "縮小", exact: true, includeHidden: true }).locator("..");
      await controls.evaluate(element => { element.style.visibility = "hidden"; });
      // 初回描画とモデルを中央へ収める次フレームを待つ。
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.locator("canvas").screenshot({ path: `public/assets/characters/previews/${character.id}.png` });
      await controls.evaluate(element => { element.style.visibility = ""; });
      console.log(`Captured ${character.id}: ${loaded.get(character.id)}`);
    }
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}

await capturePreviews();
