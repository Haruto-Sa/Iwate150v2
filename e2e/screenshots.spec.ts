import { test } from "@playwright/test";

// README 用のスクリーンショット撮影（モバイル想定の縦長ビュー）
test.use({ viewport: { width: 414, height: 896 } });

const shots: Array<{ path: string; file: string; wait?: number }> = [
  { path: "/", file: "home.png", wait: 1500 },
  { path: "/map", file: "map.png", wait: 3000 },
  { path: "/search", file: "search.png", wait: 1500 },
  { path: "/camera", file: "camera.png", wait: 1500 },
  { path: "/guide", file: "guide.png", wait: 1500 },
  { path: "/stamps", file: "stamps.png", wait: 1500 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("onboarding_completed", "true");
  });
});

for (const shot of shots) {
  test(`shot ${shot.file}`, async ({ page }) => {
    await page.goto(shot.path);
    await page.waitForTimeout(shot.wait ?? 1500);
    await page.screenshot({ path: `docs/screenshots/${shot.file}`, fullPage: false });
  });
}
