import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Camera, Heart, Sparkles } from "lucide-react";
import { fetchCities, fetchGenres, fetchSpots } from "@/lib/supabaseClient";
import { buildSpotMetadata, buildSpotJsonLd } from "@/lib/seo";
import { extractSpotIdFromSlug, getSpotHref } from "@/lib/spotRoutes";
import { getImageUrl } from "@/lib/storage";
import { Button } from "@/components/ui/Button";

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
  const imageUrl = getImageUrl(spot.image_thumb_path ?? spot.image_path ?? city?.image_path ?? null);
  const jsonLd = buildSpotJsonLd(spot);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="overflow-hidden rounded-[32px] border border-emerald-900/10 bg-white shadow-sm">
        <div className="relative h-72 bg-emerald-100 sm:h-96">
          {imageUrl ? (
            <Image src={imageUrl} alt={spot.name} fill priority sizes="100vw" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-emerald-900/60">Image coming soon</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/90">
              {city?.name ?? "Iwate"}
            </p>
            <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{spot.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">{spot.description}</p>
          </div>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-[1.2fr_0.8fr] sm:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-900">{city?.name ?? "Iwate"}</span>
              <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-900">{genre?.name ?? "Spot"}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href={`/map?focus=${spot.id}`}>
                <Button className="w-full justify-between">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    地図で場所を見る
                  </span>
                  <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/camera">
                <Button variant="outline" className="w-full justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Camera で旅の記録を残す
                  </span>
                  <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-900/10 bg-emerald-50/70 p-5">
            <h2 className="text-lg font-semibold text-[#0f1c1a]">Trip note</h2>
            <dl className="mt-4 space-y-3 text-sm text-emerald-900/75">
              <div>
                <dt className="font-medium text-[#0f1c1a]">Area</dt>
                <dd>{city?.name ?? "Iwate"}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#0f1c1a]">Category</dt>
                <dd>{genre?.name ?? "Spot"}</dd>
              </div>
              <div>
                <dt className="font-medium text-[#0f1c1a]">Coordinates</dt>
                <dd>
                  {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                </dd>
              </div>
            </dl>
            <Link href="/favorites" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-900 underline underline-offset-4">
              <Heart className="h-4 w-4" />
              お気に入りに残す
            </Link>
          </div>
        </div>
      </section>

      {relatedSpots.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-[#0f1c1a]">Nearby inspiration</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {relatedSpots.map((item) => (
              <Link
                key={item.id}
                href={getSpotHref(item)}
                className="rounded-[24px] border border-emerald-900/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300"
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
