import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { SpotVisitorStatistic } from "@/lib/spotVisitorStatistics";
import type { Spot } from "@/lib/types";
import { getSpotHref } from "@/lib/spotRoutes";
import { TravelImage } from "./TravelImage";

/**
 * 写真と地域から旅先を選べるスポットカード。
 * @param props - スポット、地域名、スポット自身の写真URL、確認済みの任意の来訪統計
 * @returns 詳細へのリンクを備えたカード
 * @example <SpotCard spot={spot} cityName="盛岡市" imageUrl={url} />
 */
export function SpotCard({
  spot,
  cityName,
  imageUrl,
  visitorStatistic,
}: {
  spot: Spot;
  cityName?: string;
  imageUrl?: string | null;
  visitorStatistic?: SpotVisitorStatistic | null;
}) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-emerald-900/15 bg-white">
      {imageUrl && (
        <div className="relative aspect-[3/2] overflow-hidden">
          <TravelImage src={imageUrl} alt={spot.name} />
        </div>
      )}
      <div className="p-5">
        <p className="mb-2 text-xs tracking-wider text-emerald-700">
          {cityName ?? "岩手県"}
        </p>
        <h3 className="font-display text-xl leading-relaxed text-emerald-950">
          {spot.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-emerald-900/80">
          {spot.description}
        </p>
        {visitorStatistic && (
          <div className="mt-3 border-t border-emerald-900/10 pt-3 text-sm text-emerald-900" aria-label={`${visitorStatistic.spotName}の観光統計`}>
            <p>{visitorStatistic.period} {visitorStatistic.metric}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{visitorStatistic.count.toLocaleString("ja-JP")}{visitorStatistic.unit}</p>
            <a href={visitorStatistic.sourceUrl} className="mt-1 inline-flex min-h-11 items-center text-xs underline underline-offset-4">
              出典 {visitorStatistic.sourceTitle} p.{visitorStatistic.sourcePage}
            </a>
          </div>
        )}
        <Link
          href={getSpotHref(spot)}
          aria-label={`${spot.name}の詳細を見る`}
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 hover:decoration-emerald-800"
        >
          詳細を見る
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
