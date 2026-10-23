"use client";

import { PageHeading } from "@/components/ui/PageHeading";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LeafletMap } from "@/components/map/LeafletMap";
import { MORIOKA_STATION } from "@/lib/config";
import { Spot } from "@/lib/types";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { PageShortcut } from "@/components/ui/PageShortcut";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useExternalNavigation } from "@/components/ui/ExternalNavigation";
import { SlidersHorizontal, MapPin, Navigation } from "lucide-react";
import { haversineDistance } from "@/lib/geo";
import { buildGoogleMapsUrl } from "@/lib/routeProviders";
import { getSpotHref } from "@/lib/spotRoutes";

type Props = {
  spots: Spot[];
  focusSpotId?: number | null;
};

type SpotWithDistance = Spot & { distance: number };

const DEFAULT_TARGET_NEARBY_COUNT = 20;
const DEFAULT_MAX_SEARCH_RADIUS = 20000;
const TARGET_NEARBY_OPTIONS = [20, 50, 100] as const;
const MAX_SEARCH_RADIUS_OPTIONS = [5000, 10000, 20000, 50000] as const;
const EXPANDING_RADII = [500, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 50000] as const;

/**
 * 近傍スポットを半径拡張方式で目標件数まで取得する。
 *
 * @param sortedSpots - 距離昇順ソート済みスポット
 * @param targetCount - 目標表示件数
 * @param maxRadius - 探索半径の上限（m）
 * @returns 抽出結果と採用半径
 * @example
 * const result = buildNearbyByExpandingRadius(sortedSpots, 50, 10000);
 */
function buildNearbyByExpandingRadius(
  sortedSpots: SpotWithDistance[],
  targetCount: number,
  maxRadius: number
): { items: SpotWithDistance[]; adoptedRadius: number | null } {
  if (sortedSpots.length === 0) {
    return { items: [], adoptedRadius: null };
  }

  const radiusSteps = EXPANDING_RADII.filter((radius) => radius <= maxRadius);
  const effectiveRadii =
    radiusSteps.length > 0 && radiusSteps[radiusSteps.length - 1] === maxRadius
      ? radiusSteps
      : [...radiusSteps, maxRadius];

  for (const radius of effectiveRadii) {
    const inRadius = sortedSpots.filter((spot) => spot.distance <= radius);
    if (inRadius.length >= targetCount) {
      return { items: inRadius.slice(0, targetCount), adoptedRadius: radius };
    }
  }

  const maxRadiusItems = sortedSpots.filter((spot) => spot.distance <= maxRadius);
  return {
    items: maxRadiusItems.slice(0, targetCount),
    adoptedRadius: maxRadius,
  };
}

/**
 * スポット地図画面のメインコンポーネント。
 *
 * 位置情報が取れない場合は盛岡駅を基準に近傍20件を表示し、
 * チェックで全件表示へ切り替えられる。
 *
 * @param props - プロパティ
 * @returns SpotSurface コンポーネント
 * @example
 * <SpotSurface spots={spots} />
 */
export function SpotSurface({ spots, focusSpotId = null }: Props) {
  const { requestNavigation, confirmation } = useExternalNavigation("Google Mapsでルート検索を開きます");
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(MORIOKA_STATION);
  const [initialCentered, setInitialCentered] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [locError, setLocError] = useState<string | null>(null);
  const [showAllSpots, setShowAllSpots] = useState(false);
  const [nearbyTargetCount, setNearbyTargetCount] = useState<number>(DEFAULT_TARGET_NEARBY_COUNT);
  const [maxSearchRadius, setMaxSearchRadius] = useState<number>(DEFAULT_MAX_SEARCH_RADIUS);

  const [routeNotice, setRouteNotice] = useState<string | null>(null);

  useEffect(() => {
    let watchId: number | null = null;
    const request = () => {
      if (!navigator.geolocation) {
        setLocError("位置情報に対応していません。盛岡駅を基準に表示します。");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserPos({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocError(null);
        },
        () => setLocError("位置情報を取得できませんでした。盛岡駅を基準に表示します。"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
    request();
    if (autoUpdate && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => setUserPos({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 }
      );
    }
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [autoUpdate]);

  useEffect(() => {
    if (!userPos || initialCentered) return;
    const frameId = window.requestAnimationFrame(() => {
      setMapCenter(userPos);
      setInitialCentered(true);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [initialCentered, userPos]);

  useEffect(() => {
    if (!focusSpotId) return;
    const focused = spots.find((spot) => spot.id === focusSpotId);
    if (!focused) return;
    const frameId = window.requestAnimationFrame(() => {
      setMapCenter({ lat: focused.lat, lng: focused.lng });
      setInitialCentered(true);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focusSpotId, spots]);

  const basePoint = userPos ?? MORIOKA_STATION;

  const spotsWithDistance = useMemo(() => {
    return spots
      .map((spot) => ({
        ...spot,
        distance: haversineDistance(basePoint.lat, basePoint.lng, spot.lat, spot.lng),
      }))
      .sort((left, right) => left.distance - right.distance);
  }, [basePoint.lat, basePoint.lng, spots]);

  const nearbyResult = useMemo(
    () => buildNearbyByExpandingRadius(spotsWithDistance, nearbyTargetCount, maxSearchRadius),
    [maxSearchRadius, nearbyTargetCount, spotsWithDistance]
  );
  const hasSpots = spotsWithDistance.length > 0;
  const focusedSpot = useMemo(() => {
    if (!focusSpotId) return null;
    return spotsWithDistance.find((spot) => spot.id === focusSpotId) ?? null;
  }, [focusSpotId, spotsWithDistance]);

  const nearbyDisplaySpots = useMemo(() => {
    if (!focusedSpot) return nearbyResult.items;
    if (nearbyResult.items.some((spot) => spot.id === focusedSpot.id)) return nearbyResult.items;
    return [focusedSpot, ...nearbyResult.items]
      .filter((spot, index, array) => array.findIndex((item) => item.id === spot.id) === index)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, nearbyTargetCount);
  }, [focusedSpot, nearbyResult.items, nearbyTargetCount]);

  const displaySpots = hasSpots ? (showAllSpots ? spotsWithDistance : nearbyDisplaySpots) : [];

  /**
   * スポットへのルート検索を実行し、外部地図アプリを開く。
   *
   * @param destination - 目的地座標
   * @param trigger - 確認終了後にフォーカスを戻す操作要素
   * @returns なし
   * @example
   * handleRouteRequest({ lat: 39.7, lng: 141.1 });
   */
  const handleRouteRequest = useCallback(
    (destination: { lat: number; lng: number }, trigger?: HTMLElement) => {
      const result = buildGoogleMapsUrl(destination, userPos);
      if (result.ok) {
        setRouteNotice(null);
        requestNavigation(result.url, trigger);
      } else {
        setRouteNotice(result.error);
      }
    },
    [userPos, requestNavigation]
  );

  return (
    <div className="space-y-8">
      {confirmation}
      <PageHeading title="地図" actions={<PageShortcut target="favorites" />} />

      <div className="rounded-2xl border border-app-line/15 bg-app-surface p-4">
        {hasSpots ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-app-ink/85">
                <input
                  type="checkbox"
                  checked={showAllSpots}
                  onChange={(event) => setShowAllSpots(event.target.checked)}
                  className="accent-emerald-500"
                />
                すべての観光地を表示する
              </label>
              <label className="flex items-center gap-2 text-sm text-app-ink/80">
                <input
                  type="checkbox"
                  checked={autoUpdate}
                  onChange={(event) => setAutoUpdate(event.target.checked)}
                  className="accent-emerald-500"
                />
                地図表示中は位置情報を自動更新
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!navigator.geolocation) {
                    setLocError("位置情報に対応していません。");
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
                      setUserPos(next);
                      setMapCenter(next);
                      setInitialCentered(true);
                      setLocError(null);
                    },
                    () => setLocError("位置情報を更新できませんでした。"),
                    { enableHighAccuracy: true, timeout: 8000 }
                  );
                }}
              >
                現在地を更新
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-app-line/10 bg-app-surface/75 px-3 py-2 text-sm text-app-ink/90">
                <span>表示件数</span>
                <select
                  value={nearbyTargetCount}
                  onChange={(event) => setNearbyTargetCount(Number(event.target.value))}
                  className="rounded-md border border-app-line/15 bg-app-surface px-2 py-2.5 text-app-ink"
                >
                  {TARGET_NEARBY_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} 件
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-app-line/10 bg-app-surface/75 px-3 py-2 text-sm text-app-ink/90">
                <span>最大検索半径</span>
                <select
                  value={maxSearchRadius}
                  onChange={(event) => setMaxSearchRadius(Number(event.target.value))}
                  className="rounded-md border border-app-line/15 bg-app-surface px-2 py-2.5 text-app-ink"
                >
                  {MAX_SEARCH_RADIUS_OPTIONS.map((radius) => (
                    <option key={radius} value={radius}>
                      {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {locError && (
              <div className="mt-2 rounded-lg border border-app-warning/30 bg-app-warning-surface px-3 py-2 text-xs text-app-warning">
                {locError}
              </div>
            )}
            {routeNotice && (
              <div role="alert" className="mt-2 rounded-lg border border-app-info/30 bg-app-info-surface px-3 py-2 text-xs text-app-info">
                {routeNotice}
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl border border-app-line/10">
              <LeafletMap
                center={mapCenter}
                zoom={9}
                spots={displaySpots}
                showUser
                userPosition={userPos}
                onRouteRequest={handleRouteRequest}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-app-line/15 bg-app-surface/70 px-4 py-8 text-center text-sm text-app-ink-muted">
            地図に表示できるスポットを準備しています。検索からも旅先を探せます。
          </div>
        )}
      </div>

      <SectionTitle
        label={hasSpots ? `${showAllSpots ? "すべてのスポット" : userPos ? "現在地から近い順" : "盛岡駅から近い順"}（${displaySpots.length}件）` : "スポット一覧"}
        icon={SlidersHorizontal}
      />
      <div className="card-grid">
        {hasSpots ? (
          displaySpots.map((spot) => (
            <GlassCard
              key={spot.id}
              title={spot.name}
              icon={MapPin}
              badge={`${Math.round(spot.distance)} m`}
            >
              <p className="line-clamp-2 text-sm text-app-ink/80">{spot.description}</p>
              <div className="mt-3 flex items-center gap-3">
                <a
                  href={getSpotHref(spot)}
                  className="inline-flex items-center gap-2 text-xs text-app-accent-ink underline underline-offset-4"
                >
                  詳細を見る
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => handleRouteRequest({ lat: spot.lat, lng: spot.lng }, event.currentTarget)}
                  className="gap-1"
                >
                  <Navigation className="h-3 w-3" />
                  ルート検索
                </Button>
              </div>
            </GlassCard>
          ))
        ) : (
          <GlassCard title="公開スポットはまだありません" icon={MapPin}>
            <p className="text-sm text-app-ink/75">
              スポット情報が公開されると、ここから場所やルートを確認できます。
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
