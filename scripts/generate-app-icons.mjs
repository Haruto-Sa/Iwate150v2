import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("public/icons/voja-mark.svg", root));
const sizes = [[192, "icon-192.png"], [512, "icon-512.png"], [180, "apple-touch-icon.png"]];
for (const [size, filename] of sizes) {
  await sharp(source).resize(size, size).png().toFile(new URL(`public/icons/${filename}`, root).pathname);
}

/**
 * PNG画像をICOコンテナーへ格納する。faviconの16/32/48pxを同じ原図から作る。
 * @param {number[]} dimensions 固定の出力サイズ
 * @returns {Promise<Buffer>} ICOファイル
 * @example await createIco([16, 32, 48]);
 */
async function createIco(dimensions) {
  const images = await Promise.all(dimensions.map(size => sharp(source).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((png, index) => {
    const entry = 6 + index * 16;
    header[entry] = dimensions[index];
    header[entry + 1] = dimensions[index];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images]);
}
await writeFile(new URL("src/app/favicon.ico", root), await createIco([16, 32, 48]));
console.log("Generated PWA, Apple touch and favicon assets from voja-mark.svg");
