import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, MapPin, Search } from "lucide-react";
import { fetchCities, fetchEvents, fetchSpots } from "@/lib/supabaseClient";
import { HomeCalendarSwitcher } from "@/components/home/HomeCalendarSwitcher";
import { SpotCard } from "@/components/ui/SpotCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getImageUrl, resolveServerStorageUrls } from "@/lib/storage";
import { buildPageMetadata, buildHomeJsonLd } from "@/lib/seo";

export const revalidate = 60;
export const metadata = buildPageMetadata({
  title: "岩手の旅を見つける",
  description: "岩手の風景、観光スポット、イベントを探して、自分だけの旅へ。",
  path: "/",
});

/**
 * 写真、目的別導線、旅先とイベントで岩手の旅を案内する。
 * @returns データ取得済みのホーム画面
 * @example <Home />
 */
export default async function Home() {
  const [events, spots, cities] = await Promise.all([
    fetchEvents(),
    fetchSpots(),
    fetchCities(),
  ]);
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const featured = spots.slice(0, 3);
  const paths = featured.map(
    (spot) => spot.image_thumb_path ?? spot.image_path ?? null,
  );
  const resolvedImages = await resolveServerStorageUrls(paths, "image");
  return (
    <div className="space-y-8 sm:space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildHomeJsonLd(events)),
        }}
      />
      <section className="grid overflow-hidden rounded-[1.5rem] border border-emerald-900/15 bg-[#eeeee4] md:grid-cols-[.9fr_1.1fr]">
        <div className="flex flex-col justify-center px-6 py-8 sm:p-10 lg:p-12">
          <h1 className="font-display text-3xl leading-relaxed text-emerald-950 lg:text-4xl">岩手の旅先</h1>
          <div className="mt-7">
            <Link href="/search" className="action-link">
              旅先を探す
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <figure className="relative min-h-64 md:min-h-72">
          <Image
            src="/images/cities/Miyako_icon.jpg"
            alt="宮古の青い海と白い岩の風景"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 55vw"
            className="object-cover"
          />
          <figcaption className="absolute bottom-4 right-4 rounded-full bg-white/95 px-4 py-2 text-xs tracking-wider text-emerald-950">
            宮古市 / 三陸の海
          </figcaption>
        </figure>
      </section>

      <nav
        aria-label="旅の楽しみ方"
        className="grid divide-y divide-emerald-900/15 border-y border-emerald-900/15 md:grid-cols-3 md:divide-x md:divide-y-0"
      >
        {[
          {
            title: "検索",
            icon: Search,
            href: "/search",
          },
          {
            title: "地図を見る",
            icon: MapPin,
            href: "/map",
          },
          {
            title: "写真を撮る",
            icon: Camera,
            href: "/camera",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-4 px-3 py-4 transition-colors hover:bg-emerald-50 sm:px-6"
          >
            <item.icon
              className="h-5 w-5 shrink-0 text-emerald-800"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle
            label="旅先のヒント"
          />
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-emerald-800"
          >
            もっと探す
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((spot, index) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              cityName={cityById.get(spot.city_id)?.name}
              imageUrl={
                paths[index]
                  ? (resolvedImages.get(paths[index]!) ??
                    getImageUrl(paths[index]!))
                  : null
              }
            />
          ))}
        </div>
        {featured.length === 0 && (
          <p className="rounded-xl border border-emerald-900/15 p-6 text-sm">
            旅先の情報を準備しています。
          </p>
        )}
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_1fr]">
        <HomeCalendarSwitcher events={events} />
        <section className="space-y-5">
          <SectionTitle
            label="イベント"
          />
          <ul className="divide-y divide-emerald-900/15 border-y border-emerald-900/15">
            {events.slice(0, 4).map((event) => (
              <li key={event.id} className="flex items-start gap-5 py-5">
                <time
                  dateTime={event.start_date ?? undefined}
                  className="shrink-0 border-l-2 border-[#a14432] pl-3 font-display text-xl tabular-nums text-emerald-800"
                >
                  {event.start_date?.slice(5).replace("-", "/") ?? "未定"}
                </time>
                <div>
                  <h3 className="text-sm font-medium leading-6">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-xs leading-6 text-emerald-900/75">
                    {event.location ?? "開催地は確認中"}
                    {event.end_date && event.end_date !== event.start_date
                      ? ` / ${event.end_date}まで`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {events.length === 0 && (
            <p className="text-sm text-emerald-900/80">
              近日開催予定のイベントはありません
            </p>
          )}
          <Link
            href="/search?tab=event"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-emerald-800"
          >
            イベントを探す
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
