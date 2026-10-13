import { expect, test } from "./fixtures";

const shots = [
  { path: "/", file: "home.png", text: "今日の気分で、岩手の旅先を見つけよう。" },
  { path: "/map", file: "map.png", text: "Map" },
  { path: "/search", file: "search.png", text: "人気のスポット" },
  { path: "/camera", file: "camera.png", text: "はじめてでも大丈夫です。" },
  { path: "/character", file: "character.png", text: "キャラクターを選ぶ" },
  { path: "/stamps", file: "stamps.png", text: "Stamps start with login" },
];

for (const shot of shots) {
  test(`shot ${shot.file}`, async ({ page }, testInfo) => {
    await page.goto(shot.path);
    await expect(page.getByRole("main").getByText(shot.text, { exact: shot.path !== "/camera" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(shot.file), fullPage: false });
  });
}
