"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CheckCircle2, Circle, MapPin, Stamp as StampIcon } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useStampCollection } from "@/hooks/useStampCollection";
import { IWATE_CENTER } from "@/lib/config";
import { formatDistance } from "@/lib/geo";
import { getSpotHref } from "@/lib/spotRoutes";

const LeafletMap = dynamic(
  () =>
    import("@/components/map/LeafletMap").then((module) => module.LeafletMap),
  { ssr: false },
);

/**
 * 公開スタンプマップと、ログイン後の本人の収集状態を表示する。
 * @returns 市町村別対象・本人進捗・位置情報による収集操作
 * @example <StampPage />
 */
export default function StampPage() {
  const collection = useStampCollection();
  const { progress } = collection;
  const personalReady = collection.personalReady && !collection.isSample;
  const percent = progress.total
    ? Math.round((progress.earned / progress.total) * 100)
    : 0;
  return (
    <div className="space-y-6">
      <PageHeading
        title="スタンプ"
        actions={!collection.authenticated && !collection.authLoading && (
          <Link href="/login?next=%2Fstamps" className="action-link">ログインしてスタンプを集める</Link>
        )}
      />
      {collection.privateError && (
        <div className="space-y-3 rounded-2xl border border-app-danger/30 bg-app-danger-surface p-5">
          <p role="alert">{collection.privateError}</p>
          <Button variant="outline" onClick={collection.reload}>
            進捗をもう一度読み込む
          </Button>
        </div>
      )}
      {collection.authenticated &&
        !collection.personalReady &&
        !collection.privateError && (
          <p role="status">本人のスタンプを確認しています。</p>
        )}
      {collection.publicError && (
        <div className="space-y-3">
          <p role="alert">{collection.publicError}</p>
          <Button onClick={collection.reload}>対象をもう一度読み込む</Button>
        </div>
      )}
      {collection.publicLoading ? (
        <p role="status">対象スポットを読み込んでいます。</p>
      ) : (
        <>
          {collection.isSample && (
            <div
              role="status"
              className="rounded-2xl border border-app-warning/30 bg-app-warning-surface p-5 text-sm leading-7"
            >
              <p>サンプル表示中。収集・保存・詳細表示はできません。</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={collection.reload}
              >
                実際の対象を再確認
              </Button>
            </div>
          )}
          {personalReady && !collection.publicError && (
            <GlassCard
              title="取得したスポット"
              icon={StampIcon}
              badge={`${progress.earned} / ${progress.total}スポット`}
            >
              <div
                role="progressbar"
                aria-label="対象スポットの収集率"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-3 overflow-hidden rounded-full bg-app-surface-tint"
              >
                <div
                  className="h-full bg-emerald-800"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-3">
                {progress.visitedCities}市町村で取得済み ／ 対象のある
                {progress.targetCities}市町村
              </p>
              {progress.unavailableCount > 0 && (
                <p className="mt-2 text-sm">
                  対象外の記録 {progress.unavailableCount}件（保存済み・達成率には含みません）
                </p>
              )}
            </GlassCard>
          )}
          <GlassCard title="近くのスタンプ" icon={MapPin}>
            <p>
              対象スポットから200m以内で取得できます。
            </p>
            <Button
              className="mt-4"
              disabled={collection.busy || !progress.total}
              onClick={() => void collection.requestLocation()}
            >
              {collection.busy ? "現在地・保存を確認中…" : "位置情報を取得"}
            </Button>
            {collection.locationError && (
              <p role="alert" className="mt-3 text-sm text-app-danger">
                {collection.locationError}
              </p>
            )}
            {collection.location && (
              <p className="mt-3 text-sm">
                現在地の推定誤差 約{Math.ceil(collection.location.accuracy)}m
              </p>
            )}
            {collection.location && collection.nearby.length === 0 && (
              <p className="mt-3">
                200m以内に対象スポットがありません。
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {collection.nearby.map((spot) => (
                <li
                  key={spot.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-line/15 bg-app-surface p-4"
                >
                  <div>
                    {collection.isSample ? (
                      <span className="font-medium">{spot.name}</span>
                    ) : (
                      <Link
                        href={getSpotHref(spot)}
                        className="font-medium underline underline-offset-4"
                      >
                        {spot.name}
                      </Link>
                    )}
                    <p className="mt-1 text-sm">
                      現在地から約{formatDistance(spot.distance)}
                    </p>
                  </div>
                  {!collection.authenticated ? (
                    <Link
                      href="/login?next=%2Fstamps"
                      className="action-link action-link-secondary"
                    >
                      ログインして収集
                    </Link>
                  ) : progress.earnedIds.has(spot.id) ? (
                    <span className="flex items-center gap-2 text-sm"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />取得済み</span>
                  ) : (
                    <Button
                      disabled={
                        !personalReady ||
                        collection.busy ||
                        Boolean(collection.publicError)
                      }
                      onClick={() => void collection.collect(spot.id)}
                      aria-label={`${spot.name}のスタンプを収集`}
                    >
                      スタンプを収集
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {collection.message && (
              <p
                role={collection.message.success ? "status" : "alert"}
                className={`mt-4 rounded-xl p-3 text-sm ${collection.message.success ? "bg-app-surface-soft" : "bg-app-danger-surface text-app-danger"}`}
              >
                {collection.message.text}
              </p>
            )}
          </GlassCard>
          <section aria-labelledby="stamp-map-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="stamp-map-title" className="font-display text-2xl">
                岩手のスタンプマップ
              </h2>
              <p className="text-sm">対象 {progress.total}スポット</p>
            </div>
            {progress.targets.length ? (
              <LeafletMap
                center={IWATE_CENTER}
                spots={progress.targets}
                showUser={false}
                showImages={false}
                showDetailLinks={!collection.isSample}
                visitedSpotIds={personalReady ? [...progress.earnedIds] : []}
                stampProgressKnown={personalReady}
              />
            ) : (
              <div className="space-y-3 rounded-2xl bg-app-surface-soft p-5">
                <p>表示できる対象がありません。</p>
                <Button variant="outline" onClick={collection.reload}>対象を再読み込み</Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <ul aria-label="地図の凡例" className="flex flex-wrap gap-4">
                <li className="flex items-center gap-2"><Circle aria-hidden="true" className="h-4 w-4" />対象スポット</li>
                {personalReady && <li className="flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />取得済み</li>}
              </ul>
              <a href="#stamp-cities-title" className="inline-flex min-h-11 items-center underline underline-offset-4">市町村から探す</a>
            </div>
          </section>
          <section aria-labelledby="stamp-cities-title" className="space-y-4">
            <h2 id="stamp-cities-title" tabIndex={-1} className="scroll-mt-24 font-display text-2xl">
              市町村から探す
            </h2>
            <p className="text-sm leading-7">
              対象スポットの取得数です。市町村全体の訪問記録ではありません。
            </p>
            <div className="grid items-start gap-3 sm:grid-cols-2">
              {progress.groups.map(({ city, spots, total, earned }) => (
                <details
                  key={city.id}
                  className="rounded-2xl border border-app-line/15 bg-app-surface p-4"
                >
                  <summary className="min-h-11 cursor-pointer py-2">
                    <span className="font-medium">{city.name}</span>
                    <span className="ml-3 text-sm">
                      {total === 0
                        ? "対象未登録"
                        : personalReady
                          ? `${earned} / ${total}スポット取得`
                          : `対象 ${total}スポット`}
                    </span>
                  </summary>
                  <ul className="space-y-3 border-t border-app-line/10 pt-3">
                    {spots.map((spot) => (
                      <li
                        key={spot.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        {collection.isSample ? (
                          <span className="py-2">{spot.name}</span>
                        ) : (
                          <Link
                            href={getSpotHref(spot)}
                            className="py-2 underline underline-offset-4"
                          >
                            {spot.name}
                          </Link>
                        )}
                        {personalReady && (
                          <span className="text-xs">
                            {progress.earnedIds.has(spot.id)
                              ? "取得済み"
                              : "未取得"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
