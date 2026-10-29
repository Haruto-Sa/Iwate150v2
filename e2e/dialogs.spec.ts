import { expect, test } from "@playwright/test";

test("初回案内は背景へのフォーカスを防ぎ、Escapeで閉じた後にページを操作できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => localStorage.setItem("voja_install_prompt_visits", "2"));
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "旅のメニュー" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(
    true,
  );
  await dialog.getByRole("button", { name: "閉じる", exact: true }).focus();
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
  const install = page.getByRole("dialog", { name: "ホーム画面に追加" });
  if (await page.evaluate(() => /iP(hone|od|ad)/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent))) {
    await expect(install).toBeVisible();
    await install.getByRole("button", { name: "ホーム画面に追加 を閉じる", exact: true }).click();
  }
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
  const isIosSafari = await page.evaluate(() => /iP(hone|od|ad)/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent));
  if (isIosSafari) {
    await expect(dialog.getByText(/Safari の共有メニュー/)).toBeVisible();
    await dialog.getByRole("button", { name: "ホーム画面に追加 を閉じる", exact: true }).click();
  } else {
    await dialog.getByRole("button", { name: "あとで", exact: true }).click();
  }
  await expect(dialog).toHaveCount(0);
  if (isIosSafari) {
    // iOSは自動表示なので入力開始前に開く。終了後の入力操作を確認する。
    await input.fill("盛岡");
    await expect(input).toHaveValue("盛岡");
  } else {
    await expect(input).toBeFocused();
  }
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});


test("初回メニューから直接写真撮影へ進み、次の訪問では再表示しない", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("dialog", { name: "旅のメニュー" });
  await page.screenshot({ path: testInfo.outputPath("first-visit-menu.png"), fullPage: true });
  await menu.getByRole("link", { name: "写真を撮る", exact: true }).click();
  await expect(page).toHaveURL(/\/camera$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "カメラ" })).toBeVisible();
  await page.reload();
  await expect(menu).toHaveCount(0);
});
