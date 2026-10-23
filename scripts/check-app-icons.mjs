import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("public/manifest.json", root), "utf8"));
for (const icon of manifest.icons) {
  const data = await readFile(new URL(`public${icon.src}`, root));
  const metadata = await sharp(data).metadata();
  assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes, icon.src);
  assert.equal(metadata.format, "png", icon.src);
  if (icon.purpose?.split(" ").includes("maskable")) {
    const { data: pixels, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const radius = Math.min(info.width, info.height) * 0.4;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4;
      assert.equal(pixels[offset + 3], 255, "Maskable background must be opaque");
      if (Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) > radius) {
        assert.deepEqual([...pixels.subarray(offset, offset + 3)], [35, 79, 64], "Artwork exceeds the maskable safe circle");
      }
    }
  }
}
assert(manifest.icons.some(icon => icon.purpose?.split(" ").includes("maskable")), "Missing maskable icon");
const apple = await sharp(new URL("public/icons/apple-touch-icon.png", root).pathname).metadata();
assert.equal(apple.width, 180);
assert.equal(apple.height, 180);
const ico = await readFile(new URL("src/app/favicon.ico", root));
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
const dimensions = [];
for (let index = 0; index < ico.readUInt16LE(4); index++) {
  const entry = 6 + index * 16;
  const length = ico.readUInt32LE(entry + 8);
  const offset = ico.readUInt32LE(entry + 12);
  assert(offset >= 54 && offset + length <= ico.length, "Invalid ICO entry bounds");
  const metadata = await sharp(ico.subarray(offset, offset + length)).metadata();
  assert.equal(metadata.width, ico[entry]);
  assert.equal(metadata.height, ico[entry + 1]);
  dimensions.push(metadata.width);
}
assert.deepEqual(dimensions, [16, 32, 48]);
console.log("Verified manifest dimensions, opaque maskable safe zone, Apple touch and 16/32/48 favicon");
