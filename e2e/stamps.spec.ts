import { expect, test } from "./fixtures";
import { mockStampCatalog } from "../src/lib/mockData";

// 認証済みUIは本人APIを差し替える。PWAと実サーバー認可は既存の専用テストを維持する。
test.use({ serviceWorkers: "block" });

test("未ログインで県内の対象を閲覧し、位置情報拒否後も一覧を利用できる", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let privateRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/me/stamps")) privateRequests += 1;
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback,
        ) => error({ code: 1 } as GeolocationPositionError),
      },
    });
  });
  await page.goto("/stamps");
  await expect(
    page.getByRole("heading", { name: "岩手のスタンプマップ" }),
  ).toBeVisible();
  await expect(
    page.getByTitle("盛岡城跡公園（対象スポット）", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ログインして旅を記録" }),
  ).toHaveAttribute("href", "/login?next=%2Fstamps");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByText("盛岡市", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "盛岡城跡公園", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("盛岡城跡公園", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "位置情報を取得" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "地図と対象一覧はそのまま閲覧できます",
  );
  expect(privateRequests).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("stamps-guest.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("本人の訪問スポットが地図と市町村進捗に反映され、再読込しても保持される", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 39.7021,
    longitude: 141.1527,
    accuracy: 10,
  });
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "traveler-A", role: "user" },
        expires: "2099-01-01T00:00:00Z",
      },
    }),
  );
  await page.route("**/api/stamps/catalog", (route) =>
    route.fulfill({ json: { ...mockStampCatalog, isSample: false } }),
  );
  const ids = [3];
  const writes: unknown[] = [];
  await page.route("**/api/me/stamps**", (route) => {
    const request = route.request();
    expect(request.headers()["x-session-user"]).toBe("traveler-A");
    if (request.method() === "POST") {
      writes.push(request.postDataJSON());
      ids.push(request.postDataJSON().spotId);
    }
    return route.fulfill({
      json: {
        items: ids.map((spot_id) => ({
          id: spot_id,
          spot_id,
          user_id: 1,
          created_at: "2026-01-01",
        })),
        nextOffset: null,
      },
    });
  });
  await page.goto("/stamps");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "25",
  );
  await expect(
    page.getByTitle("龍泉洞（取得済み）", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "位置情報を取得" }).click();
  await page
    .getByRole("button", { name: "盛岡城跡公園のスタンプを収集" })
    .click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "盛岡城跡公園のスタンプを獲得しました",
  );
  expect(writes).toEqual([{ spotId: 1 }]);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  await expect(
    page.getByTitle("盛岡城跡公園（取得済み）", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 / 2スポット取得", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  expect(writes).toHaveLength(1);
  await expect(
    page.getByTitle("盛岡城跡公園（取得済み）", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("stamps-personal.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("本人取得エラーでは未確認と表示し、公開マップから再試行できる", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "traveler-A", role: "user" },
        expires: "2099-01-01T00:00:00Z",
      },
    }),
  );
  await page.route("**/api/stamps/catalog", (route) =>
    route.fulfill({ json: { ...mockStampCatalog, isSample: false } }),
  );
  let failing = true;
  await page.route("**/api/me/stamps**", (route) =>
    route.fulfill(
      failing
        ? { status: 503, json: { error: "unavailable" } }
        : { json: { items: [], nextOffset: null } },
    ),
  );
  await page.goto("/stamps");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "進捗は未確認",
  );
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByTitle("龍泉洞（対象スポット）", { exact: true }),
  ).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "進捗をもう一度読み込む" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("ログイン後もサンプル対象は本人の進捗と混ぜず収集しない", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 39.7021,
    longitude: 141.1527,
    accuracy: 10,
  });
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "traveler-A", role: "user" },
        expires: "2099-01-01T00:00:00Z",
      },
    }),
  );
  const writes: string[] = [];
  await page.route("**/api/me/stamps**", (route) => {
    if (route.request().method() !== "GET")
      writes.push(route.request().method());
    return route.fulfill({
      json: {
        items: [{ id: 1, spot_id: 1, user_id: 1, created_at: "2026-01-01" }],
        nextOffset: null,
      },
    });
  });
  await page.goto("/stamps");
  await expect(page.getByText(/現在はサンプルの対象/)).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("button", { name: "位置情報を取得" }).click();
  await expect(
    page.getByRole("button", { name: "盛岡城跡公園のスタンプを収集" }),
  ).toBeDisabled();
  await expect(
    page.getByTitle("盛岡城跡公園（対象スポット）", { exact: true }),
  ).toBeVisible();
  // 県全体の縮尺で近隣マーカーと重ならない対象を開く。
  const sampleMarker = page.getByTitle("龍泉洞（対象スポット）", { exact: true });
  await expect(sampleMarker).toHaveClass(/stamp-map-marker/);
  await sampleMarker.click();
  const popup = page.locator(".leaflet-popup-content");
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("link", { name: "詳細を見る" })).toHaveCount(0);
  await expect(popup.locator("img")).toHaveCount(0);
  await page.getByText("盛岡市", { exact: true }).click();
  await expect(page.getByRole("link", { name: "盛岡城跡公園", exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});
