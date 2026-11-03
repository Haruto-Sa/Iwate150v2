import type { Spot } from "./types";

/** 個別施設と集計期間を確認した公表値。市町村全体の数値は登録しない。 */
export type SpotVisitorStatistic = {
  cityName: string;
  spotName: string;
  period: string;
  metric: string;
  count: number;
  unit: string;
  sourceTitle: string;
  sourceUrl: string;
  sourcePage: number;
  checkedAt: string;
};

// 原資料57ページの令和4年度「総数」。書籍の刊行年度と集計年度を混同しない。
const statistics: readonly SpotVisitorStatistic[] = [{
  cityName: "岩泉町",
  spotName: "龍泉洞",
  period: "2022年度",
  metric: "観光客入込数",
  count: 145201,
  unit: "人",
  sourceTitle: "岩泉町統計書 第11号（令和5年度版）",
  sourceUrl: "https://www.town.iwaizumi.lg.jp/docs/2024052000014/file_contents/07.pdf#page=3",
  sourcePage: 57,
  checkedAt: "2026-10-24",
}];

/**
 * 自治体名と施設名の両方が一致する公表統計を返す。未確認の地点はnull。
 * IDはDBとモックで異なるため照合に使わず、部分一致や町全体からの按分も行わない。
 * @param spot - 表示する施設
 * @param cityName - 施設が属する自治体名
 * @returns 確認済みの施設統計またはnull（未掲載は0ではない）
 * @example findSpotVisitorStatistic(spot, "岩泉町");
 */
export function findSpotVisitorStatistic(spot: Pick<Spot, "name">, cityName?: string): SpotVisitorStatistic | null {
  return statistics.find(item => item.spotName === spot.name && item.cityName === cityName) ?? null;
}
