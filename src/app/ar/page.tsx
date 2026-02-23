import Link from "next/link";
import { fetchSpots } from "@/lib/supabaseClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { Orbit, Box } from "lucide-react";
import { resolveServerStorageUrls } from "@/lib/storage";

export const revalidate = 120;

export default async function ARPage() {
  const spots = await fetchSpots();
  const withModels = spots.filter((s) => s.model_path);
  const modelPathList = withModels.map((spot) => spot.model_path ?? null);
  const resolvedModelMap = await resolveServerStorageUrls(modelPathList, "model");

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-emerald-50/80 ring-1 ring-white/10">
        AR体験に対応したスポットを一覧で確認できます。気になる場所を選んで現地でお楽しみください。
      </div>

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
              <GlassCard key={spot.id} title={spot.name} icon={Box} badge={modelReady ? "AR対応" : "準備中"}>
                <p className="text-sm text-emerald-50/80">
                  {modelReady
                    ? "このスポットはAR体験の表示準備ができています。"
                    : "このスポットはAR体験の準備中です。"}
                </p>
                <Link
                  className="mt-2 inline-block text-xs text-emerald-200 underline underline-offset-4"
                  href={`/spot?focus=${spot.id}`}
                >
                  詳細ページへ
                </Link>
              </GlassCard>
            );
          })}
        </div>
      )}

      <GlassCard title="ARの楽しみ方" icon={Orbit}>
        <ul className="list-disc space-y-1 pl-4 text-sm text-emerald-50/80">
          <li>行きたいスポットの詳細ページを開く</li>
          <li>現地でカメラやAR体験を試してみる</li>
          <li>通信環境の良い場所で利用すると表示が安定します</li>
        </ul>
      </GlassCard>
    </div>
  );
}
