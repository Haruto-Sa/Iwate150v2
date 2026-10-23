import { expect, test } from "./fixtures";

test("保存したダークテーマをアプリJSより前に適用する", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("voja_color_theme", "dark"));
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async route => { await ready; await route.continue(); });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 28, 23)");
  } finally { release(); }
});

test("外観を切り替えて保存し、別タブと端末設定に追従する", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "その他", exact: true }).click();
  const choice = page.getByRole("combobox", { name: "外観", exact: true });
  await choice.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 28, 23)");
  const other = await context.newPage();
  await other.goto("/search");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "その他", exact: true }).click();
  await choice.selectOption("light");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await choice.selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await other.close();
});

for (const theme of ["light", "dark"] as const) test(`${theme}の主要画面とメニューを表示し、写真・地図・3Dを反転しない`, async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(value => localStorage.setItem("voja_color_theme", value), theme);
  for (const path of ["/", "/search", "/map", "/stamps", "/character", "/favorites", "/login", "/camera", "/ar", "/spots/3", "/camera/edit"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("main")).toBeVisible();
    if (path === "/spots/3") {
      await expect(page.getByTitle("龍泉洞", { exact: true })).toBeVisible();
      await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 15_000 });
    }
    const panel = page.locator(".bg-app-surface").first();
    if (await panel.count()) await expect(panel).toHaveCSS("background-color", theme === "dark" ? "rgb(28, 44, 38)" : "rgb(255, 255, 255)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // モデル読込でcanvasが置換されるため、DOM取得とstyle判定を同じ評価内で行う。
    const filteredMedia = await page.evaluate(() => Array.from(document.querySelectorAll("img, canvas, video, .leaflet-tile-pane")).flatMap(element => {
      const filters = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const filter = getComputedStyle(node).filter;
        if (filter !== "none") filters.push({
          media: element.tagName,
          source: element.getAttribute("src"),
          ancestor: node.tagName,
          className: node.getAttribute("class"),
          filter,
          connected: node.isConnected,
        });
      }
      return filters;
    }));
    expect(filteredMedia, `${path} (${theme})のメディアと祖先のfilter`).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${theme}-${path.replaceAll("/", "") || "home"}.png`), fullPage: true, animations: "disabled" });
  }
  await page.goto("/search");
  await page.getByRole("button", { name: "使い方", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "検索の使い方", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`${theme}-guide.png`), animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "その他", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "その他", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`${theme}-menu.png`), fullPage: true, animations: "disabled" });
  // 連続したdocument遷移ではWebKitが中断されたRSC先読みもpageerrorとして報告する。全件を証跡に残し、ここでは初期描画の不一致を検証する。
  await info.attach("browser-errors", { body: JSON.stringify(errors, null, 2), contentType: "application/json" });
  expect(errors.filter(message => /hydration|Minified React error/i.test(message))).toEqual([]);
});
