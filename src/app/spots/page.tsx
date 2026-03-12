import { redirect } from "next/navigation";

/**
 * Spot 一覧は検索ページへ統合する。
 *
 * @returns never
 * @example
 * <SpotsIndexPage />
 */
export default function SpotsIndexPage() {
  redirect("/search");
}
