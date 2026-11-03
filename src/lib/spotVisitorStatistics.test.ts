import { describe, expect, it } from "vitest";
import { findSpotVisitorStatistic } from "./spotVisitorStatistics";

describe("個別スポット統計の照合", () => {
  it("龍泉洞の集計対象と刊行年とは別の年度・単位・出典を保持する", () => {
    expect(findSpotVisitorStatistic({ name: "龍泉洞" }, "岩泉町")).toMatchObject({
      count: 145201, period: "2022年度", unit: "人", spotName: "龍泉洞", sourcePage: 57,
      sourceUrl: "https://www.town.iwaizumi.lg.jp/docs/2024052000014/file_contents/07.pdf#page=3",
    });
  });
  it("同じ自治体でも別施設・町全体・不明な自治体へ数値を流用しない", () => {
    expect(findSpotVisitorStatistic({ name: "龍泉新洞科学館" }, "岩泉町")).toBeNull();
    expect(findSpotVisitorStatistic({ name: "龍泉洞周辺" }, "岩泉町")).toBeNull();
    expect(findSpotVisitorStatistic({ name: "岩泉町" }, "岩泉町")).toBeNull();
    expect(findSpotVisitorStatistic({ name: "龍泉洞" }, "盛岡市")).toBeNull();
    expect(findSpotVisitorStatistic({ name: "龍泉洞" })).toBeNull();
  });
  it("未掲載はゼロとして補完しない", () => {
    expect(findSpotVisitorStatistic({ name: "中尊寺 金色堂" }, "平泉町")).toBeNull();
  });
});
