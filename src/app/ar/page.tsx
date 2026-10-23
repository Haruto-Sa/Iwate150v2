import { PageHeading } from "@/components/ui/PageHeading";
import Link from "next/link";
import { fetchSpots } from "@/lib/supabaseClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { Orbit, Box } from "lucide-react";
import { resolveServerStorageUrls } from "@/lib/storage";
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
  const modelPathList = withModels.map((spot) => spot.model_path ?? null);
  const resolvedModelMap = await resolveServerStorageUrls(modelPathList, "model");

  return (
    <div className="space-y-8">
      <PageHeading eyebrow="ANOTHER VIEW" title="岩手を、もっと立体的に。" description="AR体験は準備中です。いまは3Dキャラクターの表示や、キャラクターと一緒に撮れるカメラをお楽しみください。" actions={<><Link href="/character" className="action-link">3Dキャラクターを見る</Link><Link href="/camera" className="action-link action-link-secondary">カメラを開く</Link></>} />

      {withModels.length === 0 ? (
        <GlassCard title="モデル未登録" icon={Box}>
          現在、AR対応スポットを準備中です。しばらくしてから再度ご確認ください。
        </GlassCard>
      ) : (
        <div className="card-grid">
          {withModels.map((spot) => {
            const modelPath = spot.model_path;
            const modelReady = Boolean(modelPath && resolvedModelMap.get(modelPath));
            return (
              <GlassCard key={spot.id} title={spot.name} icon={Box} badge={modelReady ? "モデル登録済み" : "準備中"}>
                <p className="text-sm text-emerald-900/80">
                  {modelReady
                    ? "3Dモデルが登録されています。AR表示機能は準備中です。"
                    : "このスポットはAR体験の準備中です。"}
                </p>
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

      <GlassCard title="ひと足先に、キャラクターと" icon={Orbit}>
        <p>3D画面ではキャラクターを回して、いろいろな角度から眺められます。カメラでは旅先の風景と一緒に、思い出の一枚を残せます。</p>
      </GlassCard>
    </div>
  );
}
