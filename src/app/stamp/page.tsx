"use client";

import { useEffect, useState, useCallback } from "react";
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
  ensurePublicUser,
} from "@/lib/supabaseClient";
import { filterNearby, formatDistance } from "@/lib/geo";
import type { Spot, Stamp } from "@/lib/types";
import { useAuthSession } from "@/components/auth/SessionProvider";

const STAMP_RADIUS = 200; // meters

type NearbySpot = Spot & { distance: number };

export default function StampPage() {
  const { user, status } = useAuthSession();

  // State
  const [publicUserId, setPublicUserId] = useState<number | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [userStamps, setUserStamps] = useState<Stamp[]>([]);
  const [nearbySpots, setNearbySpots] = useState<NearbySpot[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stampingSpotId, setStampingSpotId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Initialize user and fetch data
  useEffect(() => {
    async function init() {
      setLoading(true);
      // Fetch spots
      const allSpots = await fetchSpots();
      setSpots(allSpots);

      // If logged in, ensure public user and fetch stamps
      if (user?.id) {
        const ensured = await ensurePublicUser(user.id, user.email ?? "");
        if (ensured) {
          setPublicUserId(ensured.id);
          const stamps = await fetchUserStamps(ensured.id);
          setUserStamps(stamps);
        }
      }
      setLoading(false);
    }
    if (status !== "loading") {
      init();
    }
  }, [status, user]);

  // Get user location
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
  const handleStamp = async (spotId: number) => {
    if (!publicUserId) {
      setMessage({ type: "error", text: "ログインが必要です。" });
      return;
    }

    // Check if already stamped
    if (userStamps.some((s) => s.spot_id === spotId)) {
      setMessage({ type: "error", text: "このスポットは既にスタンプ済みです。" });
      return;
    }

    setStampingSpotId(spotId);
    setMessage(null);

    const stamp = await createStamp(publicUserId, spotId);
    setStampingSpotId(null);

    if (stamp) {
      setUserStamps((prev) => [stamp, ...prev]);
      setMessage({ type: "success", text: "スタンプを獲得しました！" });
    } else {
      setMessage({ type: "error", text: "スタンプの登録に失敗しました。" });
    }
  };

  // Calculate achievement rate
  const totalSpots = spots.length;
  const earnedCount = userStamps.length;
  const achievementRate = totalSpots > 0 ? Math.round((earnedCount / totalSpots) * 100) : 0;

  // Check if spot is already stamped
  const isStamped = (spotId: number) => userStamps.some((s) => s.spot_id === spotId);

  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="space-y-6">
        <GlassCard title="ログインが必要です" icon={AlertCircle} badge="Auth">
          <p className="text-sm text-emerald-900/80">スタンプ機能を使うにはログインが必要です。</p>
          <Link href="/login">
            <Button className="mt-4">ログイン / 新規登録</Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Achievement Card */}
      <GlassCard title="スタンプ達成率" icon={Trophy} badge={`${earnedCount}/${totalSpots}`}>
        <div className="space-y-3">
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
              style={{ width: `${achievementRate}%` }}
            />
          </div>
          <p className="text-sm text-emerald-50/80">
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
              ? "border border-emerald-200/30 bg-emerald-900/30 text-emerald-200"
              : "border border-red-200/30 bg-red-900/30 text-red-200"
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
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
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
          <p className="text-sm text-emerald-50/80">
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
