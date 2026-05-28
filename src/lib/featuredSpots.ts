import type { Spot } from "@/lib/types";

/**
 * 文字列から簡易ハッシュ値を生成する。
 *
 * @param value - ハッシュ対象
 * @returns 32bit 整数ハッシュ
 * @example
 * hashString("2026-03-18:1");
 */
function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/**
 * スポット一覧から擬似ランダムなおすすめ枠を選ぶ。
 *
 * 完全なランダムではなく seed ベースで並び順を決めるため、
 * 同一 seed 中は SSR/CSR で安定した表示になる。
 *
 * @param spots - 候補スポット
 * @param count - 取得件数
 * @param seed - 並び順の種
 * @returns おすすめスポット配列
 * @example
 * pickFeaturedSpots(spots, 8, "2026-03-18");
 */
export function pickFeaturedSpots(
  spots: Spot[],
  count: number,
  seed: string = new Date().toISOString().slice(0, 10)
): Spot[] {
  return [...spots]
    .sort((left, right) => {
      const leftRank = hashString(`${seed}:${left.id}:${left.name}`);
      const rightRank = hashString(`${seed}:${right.id}:${right.name}`);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.id - right.id;
    })
    .slice(0, count);
}
