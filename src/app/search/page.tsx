import { fetchCities, fetchGenres } from "@/lib/supabaseClient";
import { SearchSurface } from "@/components/search/SearchSurface";

export const revalidate = 60;

export default async function SearchPage() {
  const [cities, genres] = await Promise.all([fetchCities(), fetchGenres()]);
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 text-sm text-emerald-900/80 ring-1 ring-emerald-900/10 shadow-sm">
        イベントと観光スポットをDB検索できます。市区町村とジャンルで絞り込み、50件単位でページング表示します。
      </div>
      <SearchSurface cities={cities} genres={genres} />
    </div>
  );
}
