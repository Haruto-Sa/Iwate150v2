"use client";

import { PageHeading } from "@/components/ui/PageHeading";

import Link from "next/link";
import { TravelImage } from "@/components/ui/TravelImage";
import { Heart, LogIn, Sparkles } from "lucide-react";
import { useResolvedStorageUrls } from "@/lib/storageSignedClient";
import { getImageUrl } from "@/lib/storage";
import { getSpotHref } from "@/lib/spotRoutes";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { useFavorites } from "@/hooks/useFavorites";
import { PUBLIC_LOGIN_PATH } from "@/lib/config";

/**
 * favorites 一覧画面。
 *
 * @returns FavoritesScreen
 * @example
 * <FavoritesScreen />
 */
export function FavoritesScreen() {
  const favorites = useFavorites();
  const imagePaths = favorites.favoriteSpots.map((spot) => spot.image_thumb_path ?? spot.image_path ?? null);
  const resolvedImageMap = useResolvedStorageUrls(imagePaths, "image");

  if (!favorites.isReady) {
    return (
      <GlassCard title="保存したスポット" icon={Heart} badge="Loading">
        <p className="text-sm text-emerald-900/75">お気に入り一覧を準備しています。</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="YOUR TRAVEL NOTES" title="また会いたい、あの場所。" description="気になった旅先を保存して、次のお出かけに。" actions={<Link href="/search" className="action-link action-link-secondary">旅先を探す</Link>} />
      {favorites.error && <p role="alert" className="text-sm text-red-800">{favorites.error}</p>}
      {!favorites.isAuthenticated && (
        <GlassCard title="ログインすると同期できます" icon={Sparkles} badge="この端末に保存">
          <p className="text-sm leading-6 text-emerald-900/75">
            この端末のお気に入りは保存されています。ログインするとデバイス間で同期できます。
          </p>
          <Link href={PUBLIC_LOGIN_PATH} className="action-link mt-4"><LogIn className="h-4 w-4" aria-hidden="true" />ログインする</Link>
        </GlassCard>
      )}

      <GlassCard title="保存したスポット" icon={Heart} badge={`${favorites.favoriteIds.length}件`}>
        {favorites.favoriteSpots.length === 0 ? (
          <p className="text-sm leading-6 text-emerald-900/75">
            まだお気に入りはありません。スポット詳細から気になる場所を保存できます。
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {favorites.favoriteSpots.map((spot) => {
              const imagePath = spot.image_thumb_path ?? spot.image_path ?? null;
              const imageUrl = imagePath
                ? (resolvedImageMap.get(imagePath) ?? getImageUrl(imagePath))
                : null;
              return (
                <article
                  key={spot.id}
                  className="overflow-hidden rounded-[1.5rem] border border-emerald-900/10 bg-white/75"
                >
                  <div className="relative h-40 bg-emerald-50">
                    <TravelImage src={imageUrl} alt={spot.name} />
                  </div>
                  <div className="space-y-3 p-4">
                    <h2 className="font-semibold text-[#0f1c1a]">{spot.name}</h2>
                    <p className="line-clamp-2 text-sm leading-6 text-emerald-900/75">{spot.description}</p>
                    <div className="flex gap-3">
                      <Link href={getSpotHref(spot)} className="action-link">詳細を見る</Link>
                      <Button
                        variant="outline"
                        onClick={() => {
                          void favorites.toggleFavorite(spot.id);
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
