import { CalendarDays } from "lucide-react";
import { StudioEventsManager } from "@/components/studio/StudioEventsManager";
import { fetchAdminEventById, fetchAdminEventsPage } from "@/lib/adminServer";
import { buildPageMetadata } from "@/lib/seo";
import { parseStudioEditParam, parseStudioPageParam, readSearchParamValue } from "@/lib/studioPageSearch";
import { fetchCities } from "@/lib/supabaseClient";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = buildPageMetadata({
  title: "Studio Events",
  description: "Studio からイベント情報を管理します。",
  path: "/studio/events",
  noIndex: true,
});

/**
 * Studio のイベント管理ページ。
 *
 * @param props - ページ props
 * @returns イベント管理画面
 * @example
 * <StudioEventsPage searchParams={Promise.resolve({ page: "1" })} />
 */
export default async function StudioEventsPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const page = parseStudioPageParam(readSearchParamValue(resolved.page));
  const editId = parseStudioEditParam(readSearchParamValue(resolved.edit));

  const [eventsPage, cities, editingEvent] = await Promise.all([
    fetchAdminEventsPage(page, 20),
    fetchCities(),
    typeof editId === "number" ? fetchAdminEventById(editId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Events management</p>
        <h2 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-zinc-950">
          <CalendarDays className="h-6 w-6 text-emerald-700" />
          イベント CRUD
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
          開始日・終了日の整合性は API 側で検証し、一覧はページング付きでサーバーから返します。
        </p>
      </section>

      <StudioEventsManager
        items={eventsPage.items}
        total={eventsPage.total}
        page={eventsPage.page}
        pageSize={eventsPage.pageSize}
        hasNext={eventsPage.hasNext}
        cities={cities}
        editingEvent={editingEvent}
      />
    </div>
  );
}

