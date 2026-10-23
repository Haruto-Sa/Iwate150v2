import { PageHeading } from "@/components/ui/PageHeading";
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

/**
 * エリア・ジャンルとキーワードから旅先を探す。
 * @param props.searchParams - 初期タブを指定するURLクエリ
 * @returns 初期候補を含む検索ページ
 * @example <SearchPage />
 */
export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "event" ? "event" : "spot";
  const [cities, genres, spots, events] = await Promise.all([
    fetchCities(),
    fetchGenres(),
    fetchSpots(),
    fetchEvents({ limit: 4 }),
  ]);
  const defaultSpots = pickFeaturedSpots(spots, 8);
  return (
    <div className="space-y-8">
      <PageHeading title="検索" />
      <SearchSurface
        key={initialTab}
        initialTab={initialTab}
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={events}
      />
    </div>
  );
}
