import Link from "next/link";
import { CalendarDays, MapPin, Sparkles, LocateFixed } from "lucide-react";
import { fetchCities, fetchEvents, fetchSpots } from "@/lib/supabaseClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { HomeCalendarSwitcher } from "@/components/home/HomeCalendarSwitcher";
import { getImageUrl, resolveServerStorageUrls } from "@/lib/storage";

export const revalidate = 60;

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

  return (
    <div className="space-y-8">
      <section className="glass relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#0e1c21] via-[#0b1a1f] to-[#0f2b32] p-6 text-white shadow-2xl ring-1 ring-emerald-900/15 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(79,255,206,0.35),transparent_38%),radial-gradient(circle_at_90%_20%,rgba(255,159,85,0.28),transparent_35%)]" />
        <div className="relative space-y-3 drop-shadow">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/90">Iwate Travel</p>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">
            今日どこ行く？ 岩手の予定をカレンダーから。
          </h1>
          <p className="max-w-2xl text-sm text-emerald-50/90 sm:text-base">
            直近イベントとスポットをまとめて確認。下部メニューからほかの機能へ移動できます。
          </p>
        </div>
      </section>

      <HomeCalendarSwitcher events={events} />

      <div className="grid gap-3 sm:grid-cols-2">
        <GlassCard title="今日からのおすすめ" icon={Sparkles} badge="Picks">
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
            {nextEvents.length === 0 && <p className="text-emerald-900/70">イベントがまだありません。</p>}
          </div>
        </GlassCard>
        <GlassCard title="近くのスポット" icon={LocateFixed} badge="500m以内">
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
                    href={`/spot?focus=${spot.id}`}
                    className="relative text-emerald-700 underline underline-offset-4"
                  >
                    開く
                  </Link>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <GlassCard title="モード別ナビ" icon={MapPin} badge="Shortcuts">
        <div className="grid gap-3 text-[#0f1c1a] sm:grid-cols-3">
          {[
            { title: "Calendar", copy: "日付主導で旅を組み立てる", icon: CalendarDays, href: "/#home-calendar" },
            { title: "Map & Stamp", copy: "位置情報でスポット＆スタンプ", icon: MapPin, href: "/spot" },
            { title: "Camera / AR", copy: "ゆるキャラと撮って共有", icon: Sparkles, href: "/camera" },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl border border-emerald-900/10 bg-white/70 px-3 py-3 text-sm text-emerald-900/85 transition hover:border-emerald-300 hover:bg-emerald-50"
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
