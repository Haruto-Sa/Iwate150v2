import { describe, expect, it } from "vitest";
import { isSpotEditorialPick } from "./spotEditorialPicks";

describe("編集おすすめの施設照合", () => {
  it.each([["御所野遺跡", "一戸町"], ["鉄の歴史館", "釜石市"], ["奥州宇宙遊学館", "奥州市"]])("%sを地域と一致するときだけ選定する", (name, city) => {
    expect(isSpotEditorialPick({ name }, city)).toBe(true);
    expect(isSpotEditorialPick({ name }, "盛岡市")).toBe(false);
    expect(isSpotEditorialPick({ name })).toBe(false);
    expect(isSpotEditorialPick({ name: `${name}周辺` }, city)).toBe(false);
  });
  it("統計がある施設や未掲載施設を自動的におすすめにしない", () => {
    expect(isSpotEditorialPick({ name: "龍泉洞" }, "岩泉町")).toBe(false);
    expect(isSpotEditorialPick({ name: "中尊寺 金色堂" }, "平泉町")).toBe(false);
  });
});
