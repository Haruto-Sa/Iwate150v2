import { fetchSpots } from "@/lib/supabaseClient";
import { SpotSurface } from "@/components/spot/SpotSurface";
import { buildPageMetadata } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildPageMetadata({
  title: "Map",
  description: "いま気になる岩手のスポットを地図で探して、近くから順に見つけられます。",
  path: "/map",
});

/**
 * 地図ページ。
 *
 * `focus` クエリがある場合は初期フォーカス対象として渡す。
 *
 * @param props.searchParams - URL クエリ
 * @returns MapPage
 * @example
 * <MapPage searchParams={Promise.resolve({ focus: "1" })} />
 */
export default async function MapPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const spots = await fetchSpots();
  const resolved = await searchParams;
  const focusParam = resolved?.focus;
  const focusValue = Array.isArray(focusParam) ? focusParam[0] : focusParam;
  const focusSpotId = Number(focusValue);
  const safeFocusId = Number.isFinite(focusSpotId) && focusSpotId > 0 ? focusSpotId : null;
  return <SpotSurface spots={spots} focusSpotId={safeFocusId} />;
}
