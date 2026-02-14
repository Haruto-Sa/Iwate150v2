"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { City, Event, Genre, Spot } from "@/lib/types";
import { Search, LocateFixed, Navigation, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { getImageUrl } from "@/lib/storage";
import Image from "next/image";
import { useResolvedStorageUrls } from "@/lib/storageSignedClient";

type SearchTab = "spot" | "event";
type SpotSearchResponse = {
  items: Spot[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};
type EventSearchResponse = {
  items: Event[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};
type Props = {
  cities: City[];
  genres: Genre[];
};

const PAGE_SIZE = 50;

/**
 * 検索 API クエリ文字列を作成する。
 *
 * @param params - クエリ構築パラメータ
 * @returns URLSearchParams
 * @example
 * const query = buildSearchQuery({ tab: "spot", page: 1, pageSize: 50 });
 */
function buildSearchQuery(params: {
  tab: SearchTab;
  keyword: string;
  cityId: string;
  genreId: string;
  page: number;
  pageSize: number;
}): URLSearchParams {
  const query = new URLSearchParams();
  query.set("tab", params.tab);
  query.set("page", String(params.page));
  query.set("pageSize", String(params.pageSize));
  if (params.keyword) query.set("keyword", params.keyword);
  if (params.cityId !== "all") query.set("cityId", params.cityId);
  if (params.tab === "spot" && params.genreId !== "all") query.set("genreId", params.genreId);
  return query;
}

/**
 * 検索画面本体。
 *
 * DB 検索 API を利用し、市区町村・ジャンル・キーワードで安全に絞り込む。
 *
 * @param props - コンポーネントプロパティ
 * @returns SearchSurface コンポーネント
 * @example
 * <SearchSurface cities={cities} genres={genres} />
 */
export function SearchSurface({ cities, genres }: Props) {
  const [tab, setTab] = useState<SearchTab>("spot");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [selectedGenreId, setSelectedGenreId] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [spotResult, setSpotResult] = useState<SpotSearchResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    hasNext: false,
  });
  const [eventResult, setEventResult] = useState<EventSearchResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    hasNext: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cityById = useMemo(() => new Map(cities.map((city) => [city.id, city])), [cities]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim().slice(0, 100));
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [keyword]);

  useEffect(() => {
    setPage(1);
  }, [tab, selectedCityId, selectedGenreId, debouncedKeyword]);

  useEffect(() => {
    if (tab !== "event") return;
    if (selectedGenreId !== "all") setSelectedGenreId("all");
  }, [selectedGenreId, tab]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const query = buildSearchQuery({
          tab,
          keyword: debouncedKeyword,
          cityId: selectedCityId,
          genreId: selectedGenreId,
          page,
          pageSize: PAGE_SIZE,
        });
        const response = await fetch(`/api/search?${query.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`search api error: ${response.status}`);
        }
        const payload = await response.json();
        if (tab === "spot") {
          setSpotResult(payload as SpotSearchResponse);
        } else {
          setEventResult(payload as EventSearchResponse);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[search] request failed", error);
        setErrorMessage("検索結果の取得に失敗しました。時間をおいて再試行してください。");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    run();
    return () => {
      controller.abort();
    };
  }, [debouncedKeyword, page, selectedCityId, selectedGenreId, tab]);

  /**
   * スポットカード用の画像パス（thumb優先）を返す。
   *
   * @param spot - スポット
   * @returns 画像パス
   * @example
   * const path = getSpotImagePathValue(spot);
   */
  const getSpotImagePathValue = useCallback(
    (spot: Spot): string | null => {
      if (spot.image_thumb_path) return spot.image_thumb_path;
      if (spot.image_path) return spot.image_path;
      const city = cityById.get(spot.city_id);
      return city?.image_thumb_path ?? city?.image_path ?? null;
    },
    [cityById]
  );

  /**
   * イベントカード用の画像パス（thumb優先）を返す。
   *
   * @param event - イベント
   * @returns 画像パス
   * @example
   * const path = getEventImagePathValue(event);
   */
  const getEventImagePathValue = useCallback(
    (event: Event): string | null => {
      if (event.city_id) {
        const city = cityById.get(event.city_id);
        return city?.image_thumb_path ?? city?.image_path ?? null;
      }
      if (!event.location) return null;
      const matched = cities.find(
        (city) => event.location?.includes(city.name) || city.name.includes(event.location ?? "")
      );
      return matched?.image_thumb_path ?? matched?.image_path ?? null;
    },
    [cities, cityById]
  );

  const activeItems = tab === "spot" ? spotResult.items : eventResult.items;
  const total = tab === "spot" ? spotResult.total : eventResult.total;
  const hasNext = tab === "spot" ? spotResult.hasNext : eventResult.hasNext;
  const hasPrev = page > 1;

  const visibleImagePaths = useMemo(() => {
    if (tab === "spot") return (activeItems as Spot[]).map((spot) => getSpotImagePathValue(spot));
    return (activeItems as Event[]).map((event) => getEventImagePathValue(event));
  }, [activeItems, getEventImagePathValue, getSpotImagePathValue, tab]);
  const resolvedImageMap = useResolvedStorageUrls(visibleImagePaths, "image");

  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4 rounded-3xl border border-emerald-900/10 bg-gradient-to-b from-[#f9fffc] to-[#eef8f4] p-4 shadow-sm ring-1 ring-emerald-900/10 sm:space-y-6 sm:p-5">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-900/15 bg-white px-4 py-3 shadow-sm">
        <Search className="h-5 w-5 text-emerald-700" strokeWidth={1.8} />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="イベント名・スポット名で検索"
          className="w-full bg-transparent text-sm text-emerald-950 placeholder:text-emerald-900/45 focus:outline-none"
        />
        <Button
          variant="ghost"
          className="h-9 border border-emerald-900/10 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          onClick={() => setKeyword("")}
        >
          クリア
        </Button>
      </div>

      <div className="grid gap-2 rounded-2xl border border-emerald-900/10 bg-white/70 p-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 px-2 py-1 text-xs text-emerald-900/75">
          市区町村
          <select
            value={selectedCityId}
            onChange={(event) => setSelectedCityId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-emerald-900/15 bg-white px-2 py-1 text-sm text-emerald-900"
          >
            <option value="all">すべて</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 px-2 py-1 text-xs text-emerald-900/75">
          ジャンル
          <select
            value={selectedGenreId}
            onChange={(event) => setSelectedGenreId(event.target.value)}
            disabled={tab !== "spot"}
            className="min-w-0 flex-1 rounded-md border border-emerald-900/15 bg-white px-2 py-1 text-sm text-emerald-900 disabled:opacity-50"
          >
            <option value="all">すべて</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2 rounded-2xl border border-emerald-900/10 bg-white/70 p-1.5">
        {[
          { key: "spot", label: "スポット", icon: LocateFixed },
          { key: "event", label: "イベント", icon: Navigation },
        ].map((item) => (
          <Button
            key={item.key}
            variant={tab === item.key ? "primary" : "ghost"}
            size="sm"
            onClick={() => setTab(item.key as SearchTab)}
            className="flex-1 justify-center gap-2"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-emerald-900/70">
        <p>
          {tab === "spot" ? "スポット" : "イベント"}: {total} 件
          {tab === "event" && "（ジャンル条件はスポットのみ対応）"}
        </p>
        <p>
          {startIndex}-{endIndex} / {total}
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      <div className="card-grid">
        {tab === "spot" &&
          (activeItems as Spot[]).map((spot) => {
            const imagePath = getSpotImagePathValue(spot);
            const imageUrl = imagePath
              ? (resolvedImageMap.get(imagePath) ?? getImageUrl(imagePath))
              : null;
            return (
              <GlassCard key={spot.id} title={spot.name} icon={LocateFixed} badge={`#${spot.id}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-emerald-900/80">{spot.description}</p>
                    <a
                      href={`/spot?focus=${spot.id}`}
                      className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
                    >
                      詳細へ
                    </a>
                  </div>
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-emerald-900/10 bg-emerald-50">
                    {imageUrl ? (
                      <Image src={imageUrl} alt={spot.name} fill sizes="96px" className="object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-emerald-700/70">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}

        {tab === "event" &&
          (activeItems as Event[]).map((event) => {
            const imagePath = getEventImagePathValue(event);
            const imageUrl = imagePath
              ? (resolvedImageMap.get(imagePath) ?? getImageUrl(imagePath))
              : null;
            return (
              <GlassCard key={event.id} title={event.title} icon={Navigation} badge={event.start_date ?? ""}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-emerald-900/80">{event.location ?? "未設定"}</p>
                  </div>
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-emerald-900/10 bg-emerald-50">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={event.location ?? event.title}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-emerald-700/70">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}

        {activeItems.length === 0 && !isLoading && (
          <GlassCard title="該当なし" icon={Search}>
            {keyword ? "別のキーワードを試してください。" : "条件を指定して検索してください。"}
          </GlassCard>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev || isLoading}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          前へ
        </Button>
        <span className="text-xs text-emerald-900/75">
          page {page}
          {isLoading ? " / 読み込み中..." : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext || isLoading}
          onClick={() => setPage((prev) => prev + 1)}
          className="gap-1"
        >
          次へ
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
