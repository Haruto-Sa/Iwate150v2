import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Spot } from "@/lib/types";
import { getSpotHref } from "@/lib/spotRoutes";
import { TravelImage } from "./TravelImage";

/**
 * 写真と地域から旅先を選べるスポットカード。
 * @param props - スポット、地域名、スポット自身の写真URL
 * @returns 詳細へのリンクを備えたカード
 * @example <SpotCard spot={spot} cityName="盛岡市" imageUrl={url} />
 */
export function SpotCard({
  spot,
  cityName,
  imageUrl,
}: {
  spot: Spot;
  cityName?: string;
  imageUrl?: string | null;
}) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-app-line/15 bg-app-surface">
      <div className="relative aspect-[3/2] overflow-hidden">
        <TravelImage src={imageUrl} alt={spot.name} />
      </div>
      <div className="p-5">
        <p className="mb-2 text-xs tracking-wider text-app-accent-ink">
          {cityName ?? "岩手県"}
        </p>
        <h3 className="font-display text-xl leading-relaxed text-app-ink-strong">
          {spot.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-app-ink/80">
          {spot.description}
        </p>
        <Link
          href={getSpotHref(spot)}
          aria-label={`${spot.name}の詳細を見る`}
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-app-accent-ink underline decoration-emerald-800/30 underline-offset-4 hover:decoration-emerald-800"
        >
          詳細を見る
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
