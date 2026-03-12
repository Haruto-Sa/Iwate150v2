import { Heart, Sparkles } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { GlassCard } from "@/components/ui/GlassCard";
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
  return (
    <AuthGate
      title="Favorites are ready when you are"
      description="気になった場所を残しておくと、次に開いた時も旅先候補をすぐに見返せます。"
      loginLabel="Login to save favorites"
    >
      <div className="space-y-6">
        <GlassCard title="Favorites" icon={Heart} badge="Coming soon">
          <p className="text-sm leading-6 text-emerald-900/75">
            このエリアでは、地図や検索で見つけたスポットを自分だけの旅メモとして保存できる予定です。
          </p>
        </GlassCard>
        <GlassCard title="Why sign in?" icon={Sparkles}>
          <p className="text-sm leading-6 text-emerald-900/75">
            サインインすると、今後追加する Stamps や進捗保存も同じアカウントでまとめて使えるようになります。
          </p>
        </GlassCard>
      </div>
    </AuthGate>
  );
}
