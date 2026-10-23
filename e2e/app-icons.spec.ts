import { expect, test } from "./fixtures";

test("installed app metadata serves decodable icons", async ({ page, request }) => {
  await page.goto("/");
  const manifestURL = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestURL).toBeTruthy();
  const response = await request.get(manifestURL!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose?.split(" ").includes("maskable"))).toBe(true);
  const appleURL = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
  expect(appleURL).toBeTruthy();
  const icons = [...manifest.icons, { src: appleURL!, sizes: "180x180" }];
  for (const icon of icons) {
    const size = await page.evaluate(async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src);
    expect(size).toBe(icon.sizes);
  }
  const favicon = await request.get("/favicon.ico");
  expect(favicon.ok()).toBe(true);
  expect([...(await favicon.body()).subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
});
