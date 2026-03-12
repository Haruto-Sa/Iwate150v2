import type { Spot } from "@/lib/types";

/**
 * スポット名を URL で扱いやすい slug へ整形する。
 *
 * @param value - スポット名
 * @returns slug
 * @example
 * slugifySpotName("盛岡城跡公園");
 */
export function slugifySpotName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * スポットから公開詳細 URL 用の slug を生成する。
 *
 * @param spot - スポット
 * @returns `id-name` 形式の slug
 * @example
 * buildSpotSlug(spot);
 */
export function buildSpotSlug(spot: Pick<Spot, "id" | "name">): string {
  const tail = slugifySpotName(spot.name);
  return tail ? `${spot.id}-${tail}` : String(spot.id);
}

/**
 * スポット詳細ページの公開 URL を返す。
 *
 * @param spot - スポット
 * @returns 詳細 URL
 * @example
 * getSpotHref(spot);
 */
export function getSpotHref(spot: Pick<Spot, "id" | "name">): string {
  return `/spots/${buildSpotSlug(spot)}`;
}

/**
 * slug からスポット ID を取り出す。
 *
 * @param slug - `id-name` 形式の slug
 * @returns spot id。無効値は null
 * @example
 * extractSpotIdFromSlug("12-morioka-castle");
 */
export function extractSpotIdFromSlug(slug: string): number | null {
  const [idPart] = slug.split("-", 1);
  const value = Number(idPart);
  return Number.isFinite(value) && value > 0 ? value : null;
}
