import { TravelImage } from "@/components/ui/TravelImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { fetchCities, fetchGenres, fetchSpots } from "@/lib/supabaseClient";
import { buildSpotMetadata, buildSpotJsonLd } from "@/lib/seo";
import { extractSpotIdFromSlug, getSpotHref } from "@/lib/spotRoutes";
import { getImageUrl } from "@/lib/storage";
import { FavoriteToggleButton } from "@/components/favorites/FavoriteToggleButton";
import { ShareButton } from "@/components/ui/ShareButton";
import { SpotLocation } from "@/components/spot/SpotLocation";
import { SITE_URL } from "@/lib/config";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Spot 詳細 metadata を生成する。
 *
 * @param props - route params
 * @returns metadata
 * @example
 * await generateMetadata({ params: Promise.resolve({ slug: "1-test" }) });
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const spotId = extractSpotIdFromSlug(slug);
  if (!spotId) {
    return buildSpotMetadata(
      {
        id: 0,
        name: "Spot",
        description: "岩手のスポット詳細ページです。",
        city_id: 0,
        genre_id: 0,
        lat: 0,
        lng: 0,
      },
      null
    );
  }

  const spots = await fetchSpots();
  const spot = spots.find((item) => item.id === spotId);
  if (!spot) {
    return buildSpotMetadata(
      {
        id: 0,
        name: "Spot",
        description: "岩手のスポット詳細ページです。",
        city_id: 0,
        genre_id: 0,
        lat: 0,
        lng: 0,
      },
      null
    );
  }

  return buildSpotMetadata(spot, getImageUrl(spot.image_thumb_path ?? spot.image_path ?? null));
}

/**
 * Spot 詳細ページ。
 *
 * @param props - route params
 * @returns SpotDetailPage
 * @example
 * <SpotDetailPage params={Promise.resolve({ slug: "1-test" })} />
 */
export default async function SpotDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const spotId = extractSpotIdFromSlug(slug);
  if (!spotId) {
    notFound();
  }

  const [spots, cities, genres] = await Promise.all([fetchSpots(), fetchCities(), fetchGenres()]);
  const spot = spots.find((item) => item.id === spotId);
  if (!spot) {
    notFound();
  }

  const city = cities.find((item) => item.id === spot.city_id) ?? null;
  const genre = genres.find((item) => item.id === spot.genre_id) ?? null;
  const relatedSpots = spots.filter((item) => item.city_id === spot.city_id && item.id !== spot.id).slice(0, 3);
  const imageUrl = getImageUrl(spot.image_thumb_path ?? spot.image_path ?? null);
  const jsonLd = buildSpotJsonLd(spot);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="overflow-hidden rounded-[32px] border border-app-line/10 bg-app-surface shadow-sm">
        <div className="relative aspect-[3/2] max-h-[32rem] w-full bg-app-surface-tint"><TravelImage src={imageUrl} alt={spot.name} sizes="(max-width: 1152px) 100vw, 1152px" /></div>
        <div className="space-y-5 p-5 sm:p-8">
          <div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-app-accent-ink">
              <span>{city?.name ?? "岩手県"}</span>
              {genre && <span>{genre.name}</span>}
            </div>
            <h1 className="mt-2 font-display text-3xl leading-relaxed text-app-ink-strong sm:text-4xl">{spot.name}</h1>
          </div>
          <p className="max-w-3xl text-sm leading-8 text-app-ink/85">{spot.description}</p>
          <div className="flex flex-wrap items-center gap-3 [&>a]:mt-0 [&>button]:mt-0">
            <FavoriteToggleButton spotId={spot.id} />
            <ShareButton title={spot.name} text={`${spot.name}を発見！`} url={`${SITE_URL}${getSpotHref(spot)}`} />
            <Link href="/camera" className="action-link action-link-secondary"><Camera className="h-4 w-4 shrink-0" aria-hidden="true" />写真を撮る</Link>
          </div>
          <SpotLocation spot={spot} />
        </div>
      </section>

      {relatedSpots.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-app-ink-strong">同じエリアのスポット</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {relatedSpots.map((item) => (
              <Link
                key={item.id}
                href={getSpotHref(item)}
                className="rounded-[24px] border border-app-line/10 bg-app-surface p-5 shadow-sm transition hover:border-app-line-soft"
              >
                <p className="text-sm font-semibold text-app-ink-strong">{item.name}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-app-ink-muted">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
