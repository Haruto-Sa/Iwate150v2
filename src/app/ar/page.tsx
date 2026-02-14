import Link from "next/link";
import { fetchSpots } from "@/lib/supabaseClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { Orbit, Box } from "lucide-react";
import { getModelUrl, resolveServerStorageUrls } from "@/lib/storage";

export const revalidate = 120;

export default async function ARPage() {
  const spots = await fetchSpots();
  const withModels = spots.filter((s) => s.model_path);
  const modelPathList = withModels.map((spot) => spot.model_path ?? null);
  const resolvedModelMap = await resolveServerStorageUrls(modelPathList, "model");

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-emerald-50/80 ring-1 ring-white/10">
        AR表示を予定しているスポットのモデル一覧です。モデル付きスポットはここから確認できます。
      </div>

      {withModels.length === 0 ? (
        <GlassCard title="モデル未登録" icon={Box}>
          3Dモデル付きのスポットがまだありません。Supabase Storage に glTF/obj を追加するとここに表示されます。
        </GlassCard>
      ) : (
        <div className="card-grid">
          {withModels.map((spot) => {
            const modelPath = spot.model_path;
            const modelUrl = modelPath
              ? (resolvedModelMap.get(modelPath) ?? getModelUrl(modelPath))
              : null;
            return (
            <GlassCard key={spot.id} title={spot.name} icon={Box} badge={`ID ${spot.id}`}>
              <p className="break-all text-sm text-emerald-50/80">{modelUrl}</p>
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

      <GlassCard title="今後の拡張メモ" icon={Orbit} badge="Roadmap">
        <ul className="list-disc space-y-1 pl-4 text-sm text-emerald-50/80">
          <li>model_path を glTF / obj に統一し three.js で読み込み</li>
          <li>lat / lng と連動した locAR.js / AR.js 表示</li>
          <li>Supabase Storage + CDN でモデルを配信</li>
          <li>カメラページと共通のキャラモデル管理</li>
        </ul>
      </GlassCard>
    </div>
  );
}
