import { pickFeaturedSpots } from "@/lib/featuredSpots";
import { fetchCities, fetchEvents, fetchGenres, fetchSpots } from "@/lib/supabaseClient";
import { SearchSurface } from "@/components/search/SearchSurface";
import { buildPageMetadata } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildPageMetadata({
  title: "Search",
  description: "岩手のスポットやイベントを、キーワードやエリアからすばやく探せます。",
  path: "/search",
});

export default async function SearchPage() {
  const [cities, genres, spots, events] = await Promise.all([
    fetchCities(),
    fetchGenres(),
    fetchSpots(),
    fetchEvents({ limit: 4 }),
  ]);
  const defaultSpots = pickFeaturedSpots(spots, 8);
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 text-sm text-emerald-900/80 ring-1 ring-emerald-900/10 shadow-sm">
        気になるキーワード、エリア、ジャンルから、行きたい場所やイベントを見つけられます。
      </div>
      <SearchSurface
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={events}
      />
    </div>
  );
}
