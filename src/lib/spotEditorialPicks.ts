import type { Spot } from "./types";

// 地域と体験の幅を広げる編集選定。来訪者数や人気順位からは選ばない。
const editorialPicks = [
  { cityName: "一戸町", spotName: "御所野遺跡" },
  { cityName: "釜石市", spotName: "鉄の歴史館" },
  { cityName: "奥州市", spotName: "奥州宇宙遊学館" },
] as const;

/**
 * 施設名と自治体名が一致する編集おすすめを判定する。
 * @param spot - 表示する施設
 * @param cityName - 施設が属する自治体
 * @returns 編集選定した施設ならtrue（統計の有無には依存しない）
 * @example isSpotEditorialPick(spot, "一戸町");
 */
export function isSpotEditorialPick(spot: Pick<Spot, "name">, cityName?: string): boolean {
  return editorialPicks.some(item => item.spotName === spot.name && item.cityName === cityName);
}
