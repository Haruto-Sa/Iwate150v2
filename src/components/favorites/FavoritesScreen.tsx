"use client";

import Link from "next/link";
import Image from "next/image";
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
      <GlassCard title="Favorites" icon={Heart} badge="Loading">
        <p className="text-sm text-emerald-900/75">お気に入り一覧を準備しています。</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {!favorites.isAuthenticated && (
        <GlassCard title="ログインすると同期できます" icon={Sparkles} badge="Guest mode">
          <p className="text-sm leading-6 text-emerald-900/75">
            この端末のお気に入りは保存されています。ログインするとデバイス間で同期できます。
          </p>
          <Link href={PUBLIC_LOGIN_PATH} className="mt-4 inline-block">
            <Button className="gap-2">
              <LogIn className="h-4 w-4" />
              ログインする
            </Button>
          </Link>
        </GlassCard>
      )}

      <GlassCard title="Favorites" icon={Heart} badge={`${favorites.favoriteIds.length}件`}>
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
                    {imageUrl ? (
                      <Image src={imageUrl} alt={spot.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-emerald-900/50">No image</div>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <h2 className="font-semibold text-[#0f1c1a]">{spot.name}</h2>
                    <p className="line-clamp-2 text-sm leading-6 text-emerald-900/75">{spot.description}</p>
                    <div className="flex gap-3">
                      <Link href={getSpotHref(spot)} className="inline-flex">
                        <Button className="justify-center">詳細を見る</Button>
                      </Link>
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
