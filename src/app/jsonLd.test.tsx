import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import SpotDetailPage from "@/app/spots/[slug]/page";
import { buildHomeJsonLd, buildSpotJsonLd } from "@/lib/seo";
import type { Event, Spot } from "@/lib/types";

const data = vi.hoisted(() => ({ events: [] as Event[], spots: [] as Spot[] }));

vi.mock("@/lib/supabaseClient", () => ({
  fetchEvents: async () => data.events,
  fetchSpots: async () => data.spots,
  fetchCities: async () => [],
  fetchGenres: async () => [],
}));
vi.mock("@/lib/storage", () => ({
  getImageUrl: () => null,
  resolveServerStorageUrls: async () => new Map(),
}));
vi.mock("@/components/home/HomeCalendarSwitcher", () => ({ HomeCalendarSwitcher: () => null }));
vi.mock("@/components/favorites/FavoriteToggleButton", () => ({ FavoriteToggleButton: () => null }));
vi.mock("@/components/ui/ShareButton", () => ({ ShareButton: () => null }));

const inputs = [
  '岩手の旅 <景色> & "写真" \\ テキスト\u2028次の行\u2029次の段落',
  '</script><script>window.__jsonLdCanary = 1</script>',
  '</ScRiPt><img data-injected="true" src=x onerror="window.__jsonLdCanary = 1">',
  '</script ><script>window.__jsonLdCanary = 1</script>',
  '<!--<script>HTML tokenizer state</script>',
];

describe.each(["home", "spot"] as const)("%sのJSON-LD HTML境界", (page) => {
  it.each(inputs)("入力をscript要素の外へ出さず元のJSON値を保持する: %s", async (input) => {
    data.events = [{ id: 1, title: input, location: input }];
    data.spots = [{ id: 1, name: input, description: input, city_id: 1, genre_id: 1, lat: 39.7, lng: 141.1 }];
    const element = page === "home" ? await Home() : await SpotDetailPage({ params: Promise.resolve({ slug: "1" }) });
    // 実ページのSSR文字列をHTMLパーサーに渡す。ReactのDOM挿入だけでは境界の破壊を検出できない。
    const document = new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html");
    const scripts = document.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].type).toBe("application/ld+json");
    expect(document.querySelector("[data-injected]")).toBeNull();
    const expected = page === "home" ? buildHomeJsonLd(data.events) : buildSpotJsonLd(data.spots[0]);
    expect(JSON.parse(scripts[0].textContent ?? "")).toEqual(JSON.parse(JSON.stringify(expected)));
  });
});
