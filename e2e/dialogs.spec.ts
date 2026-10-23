import { expect, test } from "@playwright/test";

test("初回案内は背景へのフォーカスを防ぎ、Escapeで閉じた後にページを操作できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "岩手の旅のはじめ方" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(
    true,
  );
  await dialog.getByRole("button", { name: "スキップ", exact: true }).focus();
  await page
    .getByRole("main")
    .getByRole("link", { name: "旅先を探す", exact: true })
    .evaluate((element) => (element as HTMLElement).focus());
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    // タブ巡回でブラウザ自身に移ることは許容し、背後のページには移らない。
    expect(
      await dialog.evaluate(
        (element) =>
          document.activeElement === document.body ||
          element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("onboarding_completed")),
  ).toBe("true");
  await page
    .getByRole("navigation", { name: "モバイル主要ページ" })
    .getByRole("link", { name: "検索", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search$/);
});

test("インストール案内はナビより上に開き、閉じると元の操作へ戻る", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_completed", "true");
    localStorage.setItem("voja_install_prompt_visits", "2");
  });
  await page.goto("/search");
  const input = page.getByRole("textbox", {
    name: "スポット・イベントのキーワード",
  });
  await input.focus();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("voja_install_prompt_visits")),
    )
    .toBe("3");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    window.dispatchEvent(event);
  });
  const dialog = page.getByRole("dialog", { name: "ホーム画面に追加" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(
    true,
  );
  await dialog.getByRole("button", { name: "あとで", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});
