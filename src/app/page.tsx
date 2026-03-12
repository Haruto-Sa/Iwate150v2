import Link from "next/link";
import { CalendarDays, MapPin, Sparkles, LocateFixed } from "lucide-react";
import { fetchCities, fetchEvents, fetchSpots } from "@/lib/supabaseClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { HomeCalendarSwitcher } from "@/components/home/HomeCalendarSwitcher";
import { getImageUrl, resolveServerStorageUrls } from "@/lib/storage";
import { buildPageMetadata, buildHomeJsonLd } from "@/lib/seo";
import { getSpotHref } from "@/lib/spotRoutes";

export const revalidate = 60;
export const metadata = buildPageMetadata({
  title: "Home",
  description: "今日のおすすめ、近くのスポット、イベント予定から岩手の旅をすぐに始められます。",
  path: "/",
});

export default async function Home() {
  const [events, spots, cities] = await Promise.all([fetchEvents(), fetchSpots(), fetchCities()]);
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const featured = spots.slice(0, 3);
  const nextEvents = events.slice(0, 4);
  const eventImagePaths = nextEvents.map((event) => {
    const city =
      (event.city_id ? cityById.get(event.city_id) : undefined) ??
      (event.location
        ? cities.find((cityItem) =>
            event.location?.includes(cityItem.name) || cityItem.name.includes(event.location ?? "")
          )
        : undefined);
    return city?.image_thumb_path ?? city?.image_path ?? null;
  });
  const featuredImagePaths = featured.map((spot) => {
    const city = cityById.get(spot.city_id);
    return spot.image_thumb_path ?? spot.image_path ?? city?.image_thumb_path ?? city?.image_path ?? null;
  });
  const resolvedImageMap = await resolveServerStorageUrls(
    [...eventImagePaths, ...featuredImagePaths],
    "image"
  );
  const homeJsonLd = buildHomeJsonLd(events);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <section className="glass relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#0e1c21] via-[#0b1a1f] to-[#0f2b32] p-6 text-white shadow-2xl ring-1 ring-emerald-900/15 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(79,255,206,0.35),transparent_38%),radial-gradient(circle_at_90%_20%,rgba(255,159,85,0.28),transparent_35%)]" />
        <div className="relative space-y-3 drop-shadow">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/90">Iwate Travel</p>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">
            今日の気分で、岩手の旅先を見つけよう。
          </h1>
          <p className="max-w-2xl text-sm text-emerald-50/90 sm:text-base">
            今日のおすすめ、近くのスポット、イベント予定をひとつの画面に。気になる場所は地図やカメラ体験へすぐにつながります。
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/map">
              <span className="interactive-lift tap-feedback inline-flex min-w-32 items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-[0_16px_36px_rgba(52,211,153,0.28)] transition duration-200 hover:bg-emerald-300">
                Map で探す
              </span>
            </Link>
            <Link href="/character">
              <span className="interactive-lift tap-feedback inline-flex min-w-32 items-center justify-center rounded-full border border-white/35 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-white/15">
                Character を見る
              </span>
            </Link>
          </div>
        </div>
      </section>

      <HomeCalendarSwitcher events={events} />

      <div className="grid gap-3 sm:grid-cols-2">
        <GlassCard title="Today's picks" icon={Sparkles} badge="Picks">
          <div className="space-y-2 text-sm text-[#0f1c1a]">
            {nextEvents.slice(0, 3).map((ev) => {
              const city =
                (ev.city_id ? cityById.get(ev.city_id) : undefined) ??
                (ev.location
                  ? cities.find(
                      (c) => ev.location?.includes(c.name) || c.name.includes(ev.location ?? "")
                    )
                  : undefined);
              const imagePath = city?.image_thumb_path ?? city?.image_path ?? null;
              const imageUrl = imagePath
                ? (resolvedImageMap.get(imagePath) ?? getImageUrl(imagePath))
                : null;
              return (
                <div
                  key={ev.id}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-white/30 px-3 py-2"
                >
                  {imageUrl && (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-20"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-white/75 via-white/65 to-white/60" />
                    </>
                  )}
                  <div className="relative">
                    <p className="font-semibold text-[#0f1c1a]">{ev.title}</p>
                    <p className="text-xs text-emerald-900/70">
                      {ev.location ?? "未設定"} / {ev.start_date}
                      {ev.end_date && ev.end_date !== ev.start_date ? ` – ${ev.end_date}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            {nextEvents.length === 0 && <p className="text-emerald-900/70">いま表示できるイベントは準備中です。</p>}
          </div>
        </GlassCard>
        <GlassCard title="Near you" icon={LocateFixed} badge="Quick stops">
          <div className="space-y-2 text-sm text-[#0f1c1a]">
            {featured.map((spot) => {
              const city = cityById.get(spot.city_id);
              const imagePath =
                spot.image_thumb_path ??
                spot.image_path ??
                city?.image_thumb_path ??
                city?.image_path ??
                null;
              const imageUrl = imagePath
                ? (resolvedImageMap.get(imagePath) ?? getImageUrl(imagePath))
                : null;
              return (
                <div
                  key={spot.id}
                  className="relative flex items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-white/30 px-3 py-2"
                >
                  {imageUrl && (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-20"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-white/75 via-white/65 to-white/60" />
                    </>
                  )}
                  <div className="relative">
                    <p className="font-semibold text-[#0f1c1a]">{spot.name}</p>
                    <p className="text-xs text-emerald-900/70">#{spot.id}</p>
                  </div>
                  <Link
                    href={getSpotHref(spot)}
                    className="relative text-emerald-700 underline underline-offset-4"
                  >
                    詳細を見る
                  </Link>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <GlassCard title="Start your trip" icon={MapPin} badge="Shortcuts">
        <div className="grid gap-3 text-[#0f1c1a] sm:grid-cols-3">
          {[
            { title: "Calendar", copy: "日付から旅の予定を見つける", icon: CalendarDays, href: "/#home-calendar" },
            { title: "Map", copy: "近くのスポットを地図で探す", icon: MapPin, href: "/map" },
            { title: "Character", copy: "旅を彩るキャラクターを 3D で楽しむ", icon: Sparkles, href: "/character" },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="interactive-lift tap-feedback group flex items-center gap-3 rounded-xl border border-emerald-900/10 bg-white/70 px-3 py-3 text-sm text-emerald-900/85 transition duration-200 hover:border-emerald-300 hover:bg-emerald-50"
            >
              <item.icon className="h-5 w-5 text-emerald-700 transition group-hover:scale-105" />
              <div>
                <p className="font-semibold text-[#0f1c1a]">{item.title}</p>
                <p className="text-emerald-900/75">{item.copy}</p>
              </div>
            </Link>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
