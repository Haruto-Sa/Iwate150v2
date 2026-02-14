import { fetchSpots } from "@/lib/supabaseClient";
import { SpotSurface } from "@/components/spot/SpotSurface";

export const revalidate = 60;

/**
 * スポットページ
 *
 * `focus` クエリが渡された場合は初期表示で対象スポットを中心表示する。
 *
 * @param props.searchParams - URL クエリ
 * @returns SpotPage コンポーネント
 */
export default async function SpotPage({
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
