import { WifiOff } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Offline",
  description: "オフライン状態です。接続を確認してから再度お試しください。",
  path: "/offline",
  noIndex: true,
});

/**
 * オフライン fallback ページ。
 *
 * @returns OfflinePage
 * @example
 * <OfflinePage />
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <GlassCard title="オフラインです" icon={WifiOff} badge="Offline">
        <p className="text-sm leading-7 text-emerald-900/75">
          接続を確認してから再度お試しください。通信が戻ると、保存済みのページやキャッシュ済みの画像は引き続き利用できます。
        </p>
      </GlassCard>
    </div>
  );
}
