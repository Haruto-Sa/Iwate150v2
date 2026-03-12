import { MapPinned } from "lucide-react";
import { StudioSpotsManager } from "@/components/studio/StudioSpotsManager";
import { fetchAdminSpotById, fetchAdminSpotsPage } from "@/lib/adminServer";
import { buildPageMetadata } from "@/lib/seo";
import { parseStudioEditParam, parseStudioPageParam, readSearchParamValue } from "@/lib/studioPageSearch";
import { fetchCities, fetchGenres } from "@/lib/supabaseClient";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = buildPageMetadata({
  title: "Studio Spots",
  description: "Studio からスポット情報を管理します。",
  path: "/studio/spots",
  noIndex: true,
});

/**
 * Studio のスポット管理ページ。
 *
 * @param props - ページ props
 * @returns スポット管理画面
 * @example
 * <StudioSpotsPage searchParams={Promise.resolve({ page: "1" })} />
 */
export default async function StudioSpotsPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const page = parseStudioPageParam(readSearchParamValue(resolved.page));
  const editId = parseStudioEditParam(readSearchParamValue(resolved.edit));

  const [spotsPage, cities, genres, editingSpot] = await Promise.all([
    fetchAdminSpotsPage(page, 20),
    fetchCities(),
    fetchGenres(),
    typeof editId === "number" ? fetchAdminSpotById(editId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Spots management</p>
        <h2 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-zinc-950">
          <MapPinned className="h-6 w-6 text-emerald-700" />
          スポット CRUD
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
          一覧 read は service role 経由で取得し、編集対象は `edit` クエリで直接開けるようにしています。
        </p>
      </section>

      <StudioSpotsManager
        items={spotsPage.items}
        total={spotsPage.total}
        page={spotsPage.page}
        pageSize={spotsPage.pageSize}
        hasNext={spotsPage.hasNext}
        cities={cities}
        genres={genres}
        editingSpot={editingSpot}
      />
    </div>
  );
}

