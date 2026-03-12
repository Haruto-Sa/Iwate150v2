import type { MetadataRoute } from "next";
import { fetchSpots } from "@/lib/supabaseClient";
import { CHARACTER_PATH, MAP_PATH, SITE_URL, SPOTS_INDEX_PATH, STAMPS_PATH } from "@/lib/config";
import { buildSpotSlug } from "@/lib/spotRoutes";

/**
 * sitemap.xml を生成する。
 *
 * @returns sitemap entries
 * @example
 * await sitemap();
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const spots = await fetchSpots();
  const staticEntries: MetadataRoute.Sitemap = [
    "",
    MAP_PATH,
    "/search",
    CHARACTER_PATH,
    "/camera",
    STAMPS_PATH,
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
    lastModified: new Date(),
  }));

  const spotEntries: MetadataRoute.Sitemap = spots.map((spot) => ({
    url: `${SITE_URL}${SPOTS_INDEX_PATH}/${buildSpotSlug(spot)}`,
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: new Date(),
  }));

  return [...staticEntries, ...spotEntries];
}
