"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Stamp as StampIcon, LogIn } from "lucide-react";
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
        eyebrow="TRAVEL STAMPS"
        title="旅の足あとを、集めよう。"
        description="岩手を歩いて、訪れた場所をひとつずつ思い出に。"
      />
      {!collection.authenticated && !collection.authLoading && (
        <GlassCard
          title="次に訪れたい場所を、地図から。"
          icon={LogIn}
          badge="公開プレビュー"
        >
          <p>
            対象スポットはログインなしで見られます。スタンプを収集・保存するにはログインしてください。このプレビューはあなたの訪問記録ではなく、サンプルが保存されることもありません。
          </p>
          <Link href="/login?next=%2Fstamps" className="action-link mt-4">
            ログインして旅を記録
          </Link>
        </GlassCard>
      )}
      {collection.privateError && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5">
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
              className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7"
            >
              現在はサンプルの対象を表示しています。本人の進捗には結び付けず、収集・保存もできません。
              サンプルから詳細ページには移動できません。
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
              title="あなたの旅の足あと"
              icon={StampIcon}
              badge={`${progress.earned} / ${progress.total}スポット`}
            >
              <div
                role="progressbar"
                aria-label="対象スポットの収集率"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-3 overflow-hidden rounded-full bg-emerald-100"
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
              {progress.earned === 0 && (
                <p className="mt-2 text-sm">
                  まだ対象スポットのスタンプはありません。最初の旅先で集めてみましょう。
                </p>
              )}
              {progress.unavailableCount > 0 && (
                <p className="mt-2 text-sm">
                  現在の対象一覧にない記録が{progress.unavailableCount}
                  件あります。保存済みの記録は保持し、この達成率には含めていません。
                </p>
              )}
            </GlassCard>
          )}
          <section aria-labelledby="stamp-map-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="stamp-map-title" className="font-display text-2xl">
                岩手のスタンプマップ
              </h2>
              <p className="text-sm">表示中の対象 {progress.total}スポット</p>
            </div>
            <p className="text-sm leading-7">
              印は対象スポットの場所です。市町村の中心点に近づくだけでは取得できません。掲載している対象の範囲を表示しており、県内すべての観光地を網羅するものではありません。
            </p>
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
              <p className="rounded-2xl bg-emerald-50 p-5">
                表示できる対象スポットがありません。時間をおいて再読み込みしてください。
              </p>
            )}
            <p className="text-sm">
              ○ 対象スポット {personalReady && "／ ✓ 取得済み"}
              。地図を使わず、下の市町村一覧からも対象を確認できます。
            </p>
          </section>
          <GlassCard title="現在地の近くで集める" icon={MapPin}>
            <p>
              対象スポットから200m以内で収集できます。収集ボタンを押すと現在地を再確認します。市町村全体の訪問を証明するものではありません。
            </p>
            <Button
              className="mt-4"
              disabled={collection.busy || !progress.total}
              onClick={() => void collection.requestLocation()}
            >
              {collection.busy ? "現在地・保存を確認中…" : "位置情報を取得"}
            </Button>
            {collection.locationError && (
              <p role="alert" className="mt-3 text-sm text-red-800">
                {collection.locationError}
              </p>
            )}
            {collection.location && (
              <p className="mt-3 text-sm">
                現在地の推定誤差: 約{Math.ceil(collection.location.accuracy)}
                m。位置のずれがあるときは取得し直してください。
              </p>
            )}
            {collection.location && collection.nearby.length === 0 && (
              <p className="mt-3">
                200m以内に対象スポットが見つかりませんでした。地図で次の旅先を探せます。
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {collection.nearby.map((spot) => (
                <li
                  key={spot.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900/15 bg-white p-4"
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
                    <span className="text-sm">✓ 取得済み</span>
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
                className={`mt-4 rounded-xl p-3 text-sm ${collection.message.success ? "bg-emerald-50" : "bg-red-50 text-red-800"}`}
              >
                {collection.message.text}
              </p>
            )}
          </GlassCard>
          <section aria-labelledby="stamp-cities-title" className="space-y-4">
            <h2 id="stamp-cities-title" className="font-display text-2xl">
              市町村ごとの対象と進捗
            </h2>
            <p className="text-sm leading-7">
              進捗は「その市町村で取得した対象スポット数 ／
              掲載対象数」です。対象未登録は未訪問を意味しません。
              {!personalReady &&
                "本人の進捗はログイン後に読み込んで表示します。"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {progress.groups.map(({ city, spots, total, earned }) => (
                <details
                  key={city.id}
                  className="rounded-2xl border border-emerald-900/15 bg-white p-4"
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
                  <ul className="space-y-3 border-t border-emerald-900/10 pt-3">
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
                              ? "✓ 取得済み"
                              : "未取得"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!total && (
                    <p className="py-2 text-sm">
                      現在表示できる対象がありません。
                    </p>
                  )}
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
