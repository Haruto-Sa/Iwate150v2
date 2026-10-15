"use client";

import { PageHeading } from "@/components/ui/PageHeading";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  MapPin,
  Navigation,
  Stamp as StampIcon,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  fetchSpots,
  fetchUserStamps,
  createStamp,
} from "@/lib/supabaseClient";
import { filterNearby, formatDistance } from "@/lib/geo";
import type { Spot, Stamp } from "@/lib/types";
import { useAuthSession } from "@/components/auth/SessionProvider";

const STAMP_RADIUS = 200; // meters

type NearbySpot = Spot & { distance: number };

/**
 * 本人APIでスタンプを保存する画面。
 * @returns スタンプ一覧と位置情報操作
 * @example <StampPage />
 */
export default function StampPage() {
  const { user, status } = useAuthSession();

  // State
  const identity = user?.id ?? null;
  const activeIdentity = useRef(identity);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null | undefined>(undefined);
  const generation = useRef(0);
  useEffect(() => { activeIdentity.current = identity; generation.current += 1; }, [identity]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [userStamps, setUserStamps] = useState<Stamp[]>([]);
  const [nearbySpots, setNearbySpots] = useState<NearbySpot[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stampingSpotId, setStampingSpotId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // 古いユーザーの応答を新しいユーザーの画面へ反映しない。
  useEffect(() => {
    let cancelled = false;
    /**
     * 公開スポットと本人スタンプを読み込む。
     * @returns 完了Promise
     * @example await init();
     */
    async function init() {
      setLoading(true);
      setInitError(null);
      setUserStamps([]);
      setMessage(null);
      setStampingSpotId(null);
      try {
        const allSpots = await fetchSpots();
        const stamps = identity ? await fetchUserStamps(identity) : [];
        if (cancelled) return;
        setSpots(allSpots);
        setUserStamps(stamps);
        if (allSpots.length === 0) setInitError("スタンプ対象のスポットをまだ表示できません。時間をおいて再度お試しください。");
      } catch {
        if (!cancelled) {
          setInitError("スタンプページの読み込みに失敗しました。再読み込みしてもう一度お試しください。");
          setSpots([]);
          setUserStamps([]);
        }
      } finally {
        if (!cancelled) { setLoadedIdentity(identity); setLoading(false); }
      }
    }
    if (status !== "loading") void init();
    return () => { cancelled = true; };
  }, [status, identity]);

  // Get user location
  /**
   * @returns なし
   * @example requestLocation();
   */
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("このブラウザは位置情報に対応していません。");
      return;
    }

    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        // Filter nearby spots
        const nearby = filterNearby(spots, loc.lat, loc.lng, STAMP_RADIUS);
        setNearbySpots(nearby);
      },
      (err) => {
        console.error("Geolocation error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("位置情報の許可が必要です。ブラウザ設定から許可してください。");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError("位置情報を取得できませんでした。");
        } else {
          setLocationError("位置情報の取得に失敗しました。");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [spots]);

  // Handle stamp press
  /**
   * @param spotId - 対象スポット
   * @returns 保存完了Promise
   * @example await handleStamp(1);
   */
  const handleStamp = async (spotId: number) => {
    if (!identity) {
      setMessage({ type: "error", text: "ログインが必要です。" });
      return;
    }

    // Check if already stamped
    if (userStamps.some((s) => s.spot_id === spotId)) {
      setMessage({ type: "error", text: "このスポットは既にスタンプ済みです。" });
      return;
    }

    const operationGeneration = generation.current;
    setStampingSpotId(spotId);
    setMessage(null);

    try {
      const stamp = await createStamp(identity, spotId);
      if (activeIdentity.current !== identity || generation.current !== operationGeneration) return;
      if (stamp) {
        setUserStamps((prev) => prev.some((item) => item.spot_id === stamp.spot_id) ? prev : [stamp, ...prev]);
        setMessage({ type: "success", text: "スタンプを獲得しました！" });
      } else {
        setMessage({ type: "error", text: "スタンプの登録に失敗しました。" });
      }
    } catch {
      if (activeIdentity.current === identity && generation.current === operationGeneration) setMessage({ type: "error", text: "スタンプの登録に失敗しました。再試行してください。" });
    } finally {
      if (activeIdentity.current === identity && generation.current === operationGeneration) setStampingSpotId(null);
    }
  };

  // Calculate achievement rate
  const totalSpots = spots.length;
  const earnedCount = userStamps.length;
  const achievementRate = totalSpots > 0 ? Math.round((earnedCount / totalSpots) * 100) : 0;

  // Check if spot is already stamped
  /**
   * @param spotId - 対象スポット
   * @returns 取得済みか
   * @example isStamped(1);
   */
  const isStamped = (spotId: number) => userStamps.some((s) => s.spot_id === spotId);

  // Loading state
  if (status === "loading" || loading || loadedIdentity !== identity) {
    return (
      <div className="space-y-6">
        <PageHeading eyebrow="TRAVEL STAMPS" title="旅の足あとを、集めよう。" description="岩手を歩いて、訪れた場所をひとつずつ思い出に。" />
        <GlassCard title="スタンプラリーを読み込み中" icon={Loader2} badge="Loading">
          <div className="flex items-center gap-3 text-sm text-emerald-900/80">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <span>スポットと進捗情報を確認しています。</span>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeading eyebrow="TRAVEL STAMPS" title="旅の足あとを、集めよう。" description="岩手を歩いて、訪れた場所をひとつずつ思い出に。" />
        <GlassCard title="ログインして、旅を記録" icon={AlertCircle} badge="スタンプラリー">
          <p className="text-sm text-emerald-900/80">
            スタンプを集めて進捗を残すにはログインが必要です。地図や検索はそのまま楽しめます。
          </p>
          <Link href="/login" className="action-link mt-4">ログインしてスタンプを始める</Link>
        </GlassCard>
        <GlassCard title="できること" icon={StampIcon}>
          <p className="text-sm text-emerald-900/75">
            ログイン後は現在地の近くにあるスポットでスタンプを集め、達成率と獲得履歴を残せます。
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <PageHeading eyebrow="TRAVEL STAMPS" title="旅の足あとを、集めよう。" description="岩手を歩いて、訪れた場所をひとつずつ思い出に。" />
      {initError && (
        <GlassCard title="スタンプ情報を表示できません" icon={AlertCircle} badge="Retry">
          <p className="text-sm text-emerald-900/80">{initError}</p>
        </GlassCard>
      )}

      {/* Achievement Card */}
      <GlassCard title="スタンプ達成率" icon={Trophy} badge={`${earnedCount}/${totalSpots}`}>
        <div className="space-y-3">
          <div role="progressbar" aria-label="スタンプ達成率" aria-valuenow={achievementRate} aria-valuemin={0} aria-valuemax={100} className="h-3 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-800 transition-all duration-500"
              style={{ width: `${achievementRate}%` }}
            />
          </div>
          <p className="text-sm text-emerald-900/80">
            {achievementRate}% 達成（{earnedCount}件 / {totalSpots}件）
          </p>
        </div>
      </GlassCard>

      {/* Location Request */}
      <GlassCard title="現在地からスタンプ" icon={Navigation} badge="GPS">
        <div className="space-y-3">
          <p className="text-sm text-emerald-900/80">
            現在地から{STAMP_RADIUS}m以内のスポットでスタンプを獲得できます。
          </p>
          <Button onClick={requestLocation} variant="primary">
            <MapPin className="h-4 w-4" />
            位置情報を取得
          </Button>
          {!userLocation && !locationError && (
            <p className="text-xs text-emerald-900/65">
              位置情報を取得すると、近くでスタンプ可能なスポットがここに表示されます。
            </p>
          )}
          {locationError && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200/30 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-800" />
              <span className="text-amber-900">{locationError}</span>
            </div>
          )}
          {userLocation && (
            <p className="text-xs text-emerald-900/70">
              取得座標: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
            </p>
          )}
        </div>
      </GlassCard>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            message.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Nearby Spots */}
      {userLocation && nearbySpots.length > 0 && (
        <GlassCard
          title={`近くのスポット (${nearbySpots.length}件)`}
          icon={MapPin}
          badge={`${STAMP_RADIUS}m以内`}
        >
          <div className="space-y-3">
            {nearbySpots.map((spot) => {
              const stamped = isStamped(spot.id);
              return (
                <div
                  key={spot.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    stamped
                      ? "border-emerald-300/60 bg-emerald-50"
                      : "border-emerald-900/10 bg-white"
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-emerald-950">{spot.name}</p>
                    <p className="text-xs text-emerald-900/70">
                      {formatDistance(spot.distance)} · #{spot.id}
                    </p>
                  </div>
                  {stamped ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-900">
                      <CheckCircle2 className="h-4 w-4" />
                      取得済み
                    </span>
                  ) : (
                    <Button
                      onClick={() => handleStamp(spot.id)}
                      disabled={stampingSpotId === spot.id}
                      className="px-4"
                    >
                      {stampingSpotId === spot.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <StampIcon className="h-4 w-4" />
                      )}
                      スタンプ
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {userLocation && nearbySpots.length === 0 && (
        <GlassCard title="近くにスポットがありません" icon={MapPin}>
          <p className="text-sm text-emerald-900/80">
            {STAMP_RADIUS}m以内にスポットが見つかりませんでした。別の場所で試してみてください。
          </p>
        </GlassCard>
      )}

      {/* Earned Stamps List */}
      <GlassCard title="獲得済みスタンプ" icon={StampIcon} badge={`${earnedCount}件`}>
        {userStamps.length === 0 ? (
          <p className="text-sm text-emerald-900/75">
            まだスタンプを獲得していません。スポットの近くで「スタンプ」ボタンを押してください。
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {userStamps.map((stamp) => {
              const spot = spots.find((s) => s.id === stamp.spot_id);
              return (
                <div
                  key={stamp.id}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-50 p-2 text-center"
                >
                  <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-800" />
                  <span className="line-clamp-2 text-[10px] leading-tight text-emerald-900">
                    {spot?.name ?? `#${stamp.spot_id}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
