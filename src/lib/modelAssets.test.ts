import { describe, expect, it } from "vitest";
import { buildUniqueCandidates, extractFileStem, resolveModelFormat, toLocalAssetUrl } from "./modelAssets";

describe("モデルアセットのURL", () => {
  it.each([
    ["https://x/models/Goshodon.obj?token=1#x", "goshodon"],
    ["/models/%E3%81%9D%E3%81%B0.obj", "そば"],
    ["/models/file.name.FBX#part?x", "file.name"],
    ["/models/plain", "plain"],
    ["/models/.hidden", ".hidden"],
    ["/models/", null],
    ["", null],
  ])("ファイル名を取得する: %s", (url, stem) => {
    expect(extractFileStem(url)).toBe(stem);
  });
  it("不正なURLエンコードでは既存のURIErrorを維持する", () => {
    expect(() => extractFileStem("/models/%invalid.obj")).toThrow(URIError);
  });
  it.each([
    ["a.FBX", "fbx"],
    ["a.fbx?signature=1#x", "fbx"],
    ["a.obj#x", "obj"],
    ["a.obj?file=a.fbx", "obj"],
    ["a", "obj"],
  ])("形式を判定する: %s", (url, format) => {
    expect(resolveModelFormat(url)).toBe(format);
  });
  it.each([
    ["models/a.obj", "/models/a.obj"],
    ["/assets/a.fbx", "/assets/a.fbx"],
    ["https://x/a.obj?token=1", "https://x/a.obj?token=1"],
    ["http://x/a.obj", "http://x/a.obj"],
    [null, null], [undefined, null], ["", null],
  ])("ローカル参照を解決する: %s", (path, url) => {
    expect(toLocalAssetUrl(path)).toBe(url);
  });
  it("候補の優先順位を保ち、空値と重複だけを除く", () => {
    expect(buildUniqueCandidates([null, "a", undefined, "a", "", "b", "a", "b"]))
      .toEqual(["a", "b"]);
    expect(buildUniqueCandidates([])).toEqual([]);
  });
});
