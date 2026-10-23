import { TravelImage } from "@/components/ui/TravelImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Camera } from "lucide-react";
import { fetchCities, fetchGenres, fetchSpots } from "@/lib/supabaseClient";
import { buildSpotMetadata, buildSpotJsonLd } from "@/lib/seo";
import { extractSpotIdFromSlug, getSpotHref } from "@/lib/spotRoutes";
import { getImageUrl } from "@/lib/storage";
import { FavoriteToggleButton } from "@/components/favorites/FavoriteToggleButton";
import { ShareButton } from "@/components/ui/ShareButton";
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

      <section className="overflow-hidden rounded-[32px] border border-emerald-900/10 bg-white shadow-sm">
        <div className="relative aspect-[3/2] max-h-[32rem] bg-emerald-100"><TravelImage src={imageUrl} alt={spot.name} sizes="(max-width: 1152px) 100vw, 1152px" /></div>
        <div className="px-5 pt-6 sm:px-8">
          <p className="text-xs tracking-wider text-emerald-700">{city?.name ?? "岩手県"}</p>
          <h1 className="mt-3 font-display text-3xl leading-relaxed text-emerald-950 sm:text-4xl">{spot.name}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-emerald-900/85">{spot.description}</p>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-[1.2fr_0.8fr] sm:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-900">{city?.name ?? "Iwate"}</span>
              <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-900">{genre?.name ?? "Spot"}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href={`/map?focus=${spot.id}`} className="action-link"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />地図で場所を見る</Link>
              <Link href="/camera" className="action-link action-link-secondary"><Camera className="h-4 w-4 shrink-0" aria-hidden="true" />カメラで旅を記録</Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-900/10 bg-emerald-50/70 p-5">
            <h2 className="text-lg font-semibold text-[#0f1c1a]">旅先のメモ</h2>
            <dl className="mt-4 space-y-3 text-sm text-emerald-900/75">
              <div>
                <dt className="font-medium text-[#0f1c1a]">エリア</dt>
                <dd>{city?.name ?? "Iwate"}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#0f1c1a]">ジャンル</dt>
                <dd>{genre?.name ?? "Spot"}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#0f1c1a]">位置</dt>
                <dd>
                  {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                </dd>
              </div>
            </dl>
            <FavoriteToggleButton spotId={spot.id} />
            <div className="mt-4 border-t border-emerald-900/10 pt-4">
              <ShareButton
                title={spot.name}
                text={`${spot.name}を発見！`}
                url={`${SITE_URL}${getSpotHref(spot)}`}
              />
            </div>
          </div>
        </div>
      </section>

      {relatedSpots.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-[#0f1c1a]">同じエリアのスポット</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {relatedSpots.map((item) => (
              <Link
                key={item.id}
                href={getSpotHref(item)}
                className="rounded-[24px] border border-emerald-900/10 bg-white p-5 shadow-sm transition hover:border-emerald-300"
              >
                <p className="text-sm font-semibold text-[#0f1c1a]">{item.name}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-emerald-900/70">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
