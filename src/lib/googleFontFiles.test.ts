import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { findFontFilesInCss } from "next/dist/compiled/@next/font/dist/google/find-font-files-in-css";
import nextFontGoogleLoader from "next/dist/compiled/@next/font/dist/google/loader";
import { describe, expect, it, vi } from "vitest";

// next@16.0.8への上流PR #100158のWebpack向けバックポートを検証する。
describe("Google Fontsのファイル形式", () => {
  it.each([
    ["https://fonts.gstatic.com/s/font.woff2", "format('woff2')", "woff2"],
    ["https://fonts.gstatic.com/s/font.ttf?kit=a&v=1#font", "format('woff2')", "ttf"],
    ["https://fonts.gstatic.com/l/font?kit=a=b&skey=c&v=v20", "format('woff2')", "woff2"],
    ["https://fonts.gstatic.com/l/font?kit=a%2Bb&skey=c", 'format("woff")', "woff"],
    ["https://fonts.gstatic.com/l/font", "format('truetype')", "ttf"],
    ["https://fonts.gstatic.com/l/font", "format('opentype')", "otf"],
    ["https://fonts.gstatic.com/l/font", "format('embedded-opentype')", "eot"],
    ["https://fonts.gstatic.com/l/font", "", "woff2"],
    ["https://fonts.gstatic.com/l/font", "format('unknown')", "woff2"],
    ["https://fonts.gstatic.com/l/font?kit=a.woff", "format('woff2')", "woff2"],
  ])("%s %s を %s として保存する", (url, format, ext) => {
    const css = `/* latin */
@font-face {
  src: url(${url}) ${format};
}`;

    expect(findFontFilesInCss(css, ["latin"])).toEqual([
      { googleFontFileUrl: url, preloadFontFile: true, ext },
    ]);
  });

  it("同じURLを重複取得せず指定したサブセットだけを先読みする", () => {
    const css = `/* latin */
@font-face {
  src: url(https://fonts.gstatic.com/s/latin.woff2) format('woff2');
}
@font-face {
  src: url(https://fonts.gstatic.com/s/latin.woff2) format('woff2');
}
/* cyrillic */
@font-face {
  src: url(https://fonts.gstatic.com/l/font?kit=cyrillic&v=1) format('woff2');
}`;

    expect(findFontFilesInCss(css, ["latin"])).toEqual([
      {
        googleFontFileUrl: "https://fonts.gstatic.com/s/latin.woff2",
        preloadFontFile: true,
        ext: "woff2",
      },
      {
        googleFontFileUrl: "https://fonts.gstatic.com/l/font?kit=cyrillic&v=1",
        preloadFontFile: false,
        ext: "woff2",
      },
    ]);
    expect(findFontFilesInCss(css).every((font) => !font.preloadFontFile)).toBe(true);
  });

  it("実ローダーが拡張子なしURLを解析しセルフホスト用URLへ置換できる", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "google-font-regression-"));
    const mockPath = path.join(directory, "responses.cjs");
    const googleUrl = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap";
    const fontUrl = "https://fonts.gstatic.com/l/font?kit=regression&skey=font&v=v20";
    const css = `/* latin */
@font-face {
  font-family: 'Cormorant Garamond';
  src: url(${fontUrl}) format('woff2');
}`;
    await writeFile(mockPath, `module.exports = ${JSON.stringify({ [googleUrl]: css })};`);
    vi.stubEnv("NEXT_FONT_GOOGLE_MOCKED_RESPONSES", mockPath);
    const emitFontFile = vi.fn(() => "/_next/static/media/regression.woff2");

    try {
      const result = await nextFontGoogleLoader({
        functionName: "Cormorant_Garamond",
        variableName: "display",
        data: [{ weight: ["600", "700"], subsets: ["latin"], adjustFontFallback: false }],
        emitFontFile,
        resolve: (src) => src,
        isDev: false,
        isServer: true,
        loaderContext: {},
      });

      expect(emitFontFile).toHaveBeenCalledWith(expect.any(Buffer), "woff2", true, false);
      expect(result.css).toContain("url(/_next/static/media/regression.woff2)");
      expect(result.css).not.toContain(fontUrl);
    } finally {
      vi.unstubAllEnvs();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
