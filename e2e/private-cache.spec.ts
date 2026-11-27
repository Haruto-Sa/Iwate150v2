import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

let server: Server;
let directory: string;
let origin: string;

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "iwate-sw-test-"));
  // 製品のWorkerと本番用キャッシュ規則をそのまま使い、プリキャッシュだけ空にする。
  execFileSync("bun", ["build", "src/app/sw.ts", "--target=browser", "--define", 'process.env.NODE_ENV="production"',
    "--define", "self.__SW_MANIFEST=[]", "--outfile", join(directory, "sw.js")], { timeout: 30_000 });
  const worker = await readFile(join(directory, "sw.js"));
  server = createServer((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    if (url.pathname === "/sw.js") {
      response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      response.end(worker);
      return;
    }
    const privatePage = url.pathname === "/studio" || url.pathname.startsWith("/studio/");
    const loggedIn = request.headers.cookie?.includes("fixture-session=admin");
    response.writeHead(privatePage && !loggedIn ? 401 : 200, {
      "Content-Type": request.headers.rsc === "1" ? "text/x-component" : "text/html",
      "Cache-Control": privatePage ? "private, no-store" : "public, max-age=60",
    });
    response.end(privatePage ? (loggedIn ? "PRIVATE_CANARY" : "UNAUTHORIZED") : "<h1>PUBLIC</h1>");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server port");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

/**
 * テスト用originで製品のService Workerを有効にする。
 * @param page - 分離されたテストページ
 * @returns 制御開始まで待つPromise
 * @example await activateWorker(page);
 */
async function activateWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test("管理画面のHTML・RSC・prefetchを保存せずログアウト後のオフラインで返さない", async ({ page, context }) => {
  await page.goto(origin);
  await activateWorker(page);
  await context.addCookies([{ name: "fixture-session", value: "admin", url: origin }]);
  const paths = ["/studio", "/studio/users?_rsc=normal", "/studio/users?_rsc=prefetch"];
  const results = await page.evaluate(async paths => Promise.all(paths.map(async (path, index) => {
    const headers: Record<string, string> = index ? { RSC: "1" } : {};
    if (index === 2) headers["Next-Router-Prefetch"] = "1";
    return (await fetch(path, { headers })).text();
  })), paths);
  expect(results).toEqual(paths.map(() => "PRIVATE_CANARY"));
  await context.clearCookies();
  await context.setOffline(true);
  const offline = await page.evaluate(async paths => Promise.all(paths.map(async (path, index) => {
    const headers: Record<string, string> = index ? { RSC: "1" } : {};
    if (index === 2) headers["Next-Router-Prefetch"] = "1";
    try { return await (await fetch(path, { headers })).text(); } catch { return "NETWORK_ERROR"; }
  })), paths);
  expect(offline).not.toContain("PRIVATE_CANARY");
  const stored = await page.evaluate(async () => {
    const requests = await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()));
    return requests.flat().map(request => new URL(request.url).pathname);
  });
  expect(stored.some(path => path === "/studio" || path.startsWith("/studio/"))).toBe(false);
});

test("更新時に旧管理画面キャッシュを除去し似た名前の公開ページを保持する", async ({ page }) => {
  await page.goto(origin);
  await page.evaluate(async () => {
    for (const name of ["pages", "pages-rsc", "pages-rsc-prefetch", "legacy-cache"]) {
      const cache = await caches.open(name);
      for (const path of ["/studio", "/studio/users?_rsc=old", "/api/me/favorites", "/studio-public"]) {
        await cache.put(path, new Response(path.startsWith("/studio-public") ? "PUBLIC" : "OLD_PRIVATE_CANARY"));
      }
    }
  });
  await activateWorker(page);
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open("legacy-cache");
    return Boolean(await cache.match("/studio"));
  })).toBe(false);
  for (const name of ["pages", "pages-rsc", "pages-rsc-prefetch", "legacy-cache"]) {
    const paths = await page.evaluate(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname), name);
    expect(paths).toEqual(["/studio-public"]);
  }
});

test("管理画面に似た名前の公開ページはオフラインでも再利用できる", async ({ page, context }) => {
  await page.goto(origin);
  await activateWorker(page);
  expect(await page.evaluate(async () => (await fetch("/studio-public")).text())).toContain("PUBLIC");
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match("/studio-public")))).toBe(true);
  await context.setOffline(true);
  expect(await page.evaluate(async () => (await fetch("/studio-public")).text())).toContain("PUBLIC");
});
