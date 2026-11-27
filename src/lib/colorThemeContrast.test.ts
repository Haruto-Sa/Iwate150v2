import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * sRGBの色から相対輝度を求める。
 * @param hex - 6桁の16進色
 * @returns WCAGの相対輝度
 * @example luminance("ffffff");
 */
function luminance(hex: string) {
  const channels = hex.match(/../g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

const css = readFileSync("src/app/globals.css", "utf8");
const light = css.slice(css.indexOf("--app-surface:"), css.indexOf(':root[data-theme="dark"]'));
const dark = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("@theme inline"));
for (const [theme, block] of [["light", light], ["dark", dark]]) {
  describe(`${theme} semantic colors`, () => {
    const colors = Object.fromEntries([...block.matchAll(/--app-([\w-]+): #([\da-f]{6});/g)].map(match => [match[1], match[2]]));
    for (const surface of ["surface", "surface-soft", "surface-tint", "surface-subtle"]) {
      for (const ink of ["ink", "ink-strong", "ink-muted", "accent-ink"]) {
        it(`${ink} on ${surface} meets normal text contrast`, () => {
          const values = [luminance(colors[ink]), luminance(colors[surface])].sort((a, b) => b - a);
          expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });
}
