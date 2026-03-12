import { redirect } from "next/navigation";

/**
 * 旧地図 URL を新 URL へ転送する。
 *
 * @param props.searchParams - URL クエリ
 * @returns never
 * @example
 * <LegacySpotPage searchParams={Promise.resolve({ focus: "1" })} />
 */
export default async function LegacySpotPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const focus = resolved?.focus;
  const focusValue = Array.isArray(focus) ? focus[0] : focus;
  redirect(focusValue ? `/map?focus=${encodeURIComponent(focusValue)}` : "/map");
}
