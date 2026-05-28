import { FavoritesScreen } from "@/components/favorites/FavoritesScreen";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Favorites",
  description: "気になったスポットをあとから見返せる、お気に入り保存エリアです。",
  path: "/favorites",
  noIndex: true,
});

/**
 * Favorites ページ。
 *
 * @returns FavoritesPage
 * @example
 * <FavoritesPage />
 */
export default function FavoritesPage() {
  return <FavoritesScreen />;
}
