import { PageHeading } from "@/components/ui/PageHeading";
import Link from "next/link";
import { fetchSpots } from "@/lib/supabaseClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { Box } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";
import { getSpotHref } from "@/lib/spotRoutes";

export const revalidate = 120;
export const metadata = buildPageMetadata({
  title: "AR",
  description: "AR 対応スポットの準備状況を確認できるベータページです。",
  path: "/ar",
  noIndex: true,
});

/**
 * ARの準備状況と利用可能な3D体験への導線。
 * @returns AR案内ページ
 * @example <ARPage />
 */
export default async function ARPage() {
  const spots = await fetchSpots();
  const withModels = spots.filter((s) => s.model_path);

  return (
    <div className="space-y-8">
      <PageHeading title="AR" actions={<><Link href="/character" className="action-link">3Dキャラクターを見る</Link><Link href="/camera" className="action-link action-link-secondary">カメラを開く</Link></>} />

      <p role="status" className="text-sm text-emerald-900">ARは準備中です。</p>
      {withModels.length > 0 && (
        <div className="card-grid">
          {withModels.map((spot) => {
            return (
              <GlassCard key={spot.id} title={spot.name} icon={Box}>
                <Link
                  className="mt-2 inline-block text-xs text-emerald-800 underline underline-offset-4"
                  href={getSpotHref(spot)}
                >
                  詳細ページへ
                </Link>
              </GlassCard>
            );
          })}
        </div>
      )}

    </div>
  );
}
