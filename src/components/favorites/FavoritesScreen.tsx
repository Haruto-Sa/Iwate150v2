"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import { TravelImage } from "@/components/ui/TravelImage";
import { SpotCard } from "@/components/ui/SpotCard";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { useResolvedStorageUrls } from "@/lib/storageSignedClient";
import { getImageUrl } from "@/lib/storage";
import { getSpotHref } from "@/lib/spotRoutes";
import { useFavorites } from "@/hooks/useFavorites";
import { PUBLIC_LOGIN_PATH } from "@/lib/config";

/**
 * ゲストには保存例、ログイン後は本人の一覧を表示する。
 * @returns サンプル・本人データ・旧保存の追加を区別した画面
 * @example <FavoritesScreen />
 */
export function FavoritesScreen() {
  const favorites = useFavorites();
  const shownSpots = favorites.isAuthenticated
    ? favorites.favoriteSpots
    : favorites.sampleSpots;
  const imagePaths = shownSpots.map(
    (spot) => spot.image_thumb_path ?? spot.image_path ?? null,
  );
  const resolvedImageMap = useResolvedStorageUrls(imagePaths, "image");
  return (
    <div className="space-y-6">
      <PageHeading
        title="お気に入り"
        actions={
          <>
            {favorites.isReady && !favorites.isAuthenticated && (
              <Link href={`${PUBLIC_LOGIN_PATH}?next=${encodeURIComponent("/favorites")}`} className="action-link">ログインして保存</Link>
            )}
            <Link href="/search" className="action-link action-link-secondary">旅先を探す</Link>
          </>
        }
      />
      {favorites.isAuthenticated && <Link href="/account" className="action-link action-link-secondary">保存データを削除</Link>}
      {!favorites.isReady ? (
        <p role="status">お気に入りを読み込んでいます。</p>
      ) : (
        <>
          {favorites.error && (
            <p
              role="alert"
              className="rounded-xl border border-app-danger/30 bg-app-danger-surface p-4 text-sm leading-7 text-app-danger"
            >
              {favorites.error}
            </p>
          )}
          {favorites.notice && (
            <p
              role="status"
              className="rounded-xl border border-app-line-soft bg-app-surface-soft p-4 text-sm leading-7"
            >
              {favorites.notice}
            </p>
          )}
          {favorites.loadFailed ? (
            <Button onClick={favorites.reload}>もう一度読み込む</Button>
          ) : (
            <>
              {!favorites.isAuthenticated ? (
                <>
                  <section
                    aria-labelledby="favorite-samples-title"
                    className="space-y-4"
                  >
                    <div>
                      <h2
                        id="favorite-samples-title"
                        className="font-display text-2xl"
                      >
                        お気に入りのサンプル
                      </h2>
                    </div>
                    <div className="card-grid">
                      {favorites.sampleSpots.map((spot) => {
                        const path = spot.image_thumb_path ?? spot.image_path;
                        return (
                          <SpotCard
                            key={spot.id}
                            spot={spot}
                            imageUrl={
                              path
                                ? (resolvedImageMap.get(path) ??
                                  getImageUrl(path))
                                : null
                            }
                          />
                        );
                      })}
                    </div>
                    {favorites.sampleSpots.length === 0 && (
                      <p className="text-sm">
                        サンプルを準備しています。検索から旅先を探せます。
                      </p>
                    )}
                  </section>
                </>
              ) : (
                <>
                  <GlassCard
                    title="あなたが保存したスポット"
                    icon={Heart}
                    badge={`${favorites.favoriteIds.length}件`}
                  >
                    {favorites.favoriteIds.length === 0 ? (
                      <div className="space-y-4">
                        <Link href="/search" className="action-link">
                          最初の旅先を探す
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {favorites.favoriteSpots.map((spot) => {
                            const path =
                              spot.image_thumb_path ?? spot.image_path;
                            return (
                              <article
                                key={spot.id}
                                className="overflow-hidden rounded-2xl border border-app-line/15 bg-app-surface"
                              >
                                <div className="relative aspect-[3/2]">
                                  <TravelImage
                                    src={
                                      path
                                        ? (resolvedImageMap.get(path) ??
                                          getImageUrl(path))
                                        : null
                                    }
                                    alt={spot.name}
                                  />
                                </div>
                                <div className="space-y-3 p-4">
                                  <h3 className="font-display text-xl">
                                    {spot.name}
                                  </h3>
                                  <p className="line-clamp-2 text-sm leading-7">
                                    {spot.description}
                                  </p>
                                  <div className="flex flex-wrap gap-3">
                                    <Link
                                      href={getSpotHref(spot)}
                                      className="action-link"
                                    >
                                      詳細を見る
                                    </Link>
                                    <Button
                                      variant="outline"
                                      aria-label={`${spot.name}をお気に入りから削除`}
                                      disabled={favorites.isMutating}
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
                        {favorites.favoriteIds.length >
                          favorites.favoriteSpots.length && (
                          <p className="mt-3 text-sm">
                            一部のスポット情報を現在表示できません。保存した記録はそのまま保持しています。
                          </p>
                        )}
                      </>
                    )}
                  </GlassCard>
                  {favorites.legacySpots.length > 0 && (
                    <section className="rounded-2xl border border-app-line/15 bg-app-surface p-5">
                      <h2 className="font-display text-xl">
                        以前この端末に保存したスポット
                      </h2>
                      <p className="mt-2 text-sm leading-7">
                        まだこのアカウントに追加されていない保存です。内容を確認してから追加してください。元の端末データは消えません。
                      </p>
                      <details className="mt-4">
                        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                          追加する内容を確認（{favorites.legacySpots.length}件）
                        </summary>
                        <ul className="max-h-60 space-y-2 overflow-y-auto py-3 text-sm">
                          {favorites.legacySpots.map((spot) => (
                            <li key={spot.id}>{spot.name}</li>
                          ))}
                        </ul>
                        <Button
                          className="mt-3"
                          disabled={favorites.isMutating}
                          onClick={() => {
                            void favorites.importLegacyFavorites();
                          }}
                        >
                          表示中の{favorites.legacySpots.length}
                          件をこのアカウントに追加
                        </Button>
                      </details>
                    </section>
                  )}
                  {favorites.hasOtherLegacyOwner && (
                    <p className="text-sm leading-7 text-app-ink/80">
                      以前の端末保存は元のアカウントで確認できます。このアカウントには追加していません。
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
