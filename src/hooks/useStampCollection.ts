"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "@/components/auth/SessionProvider";
import {
  createStamp,
  fetchStampCatalog,
  fetchUserStamps,
} from "@/lib/privateUserClient";
import { filterNearby, haversineDistance } from "@/lib/geo";
import {
  buildStampProgress,
  locateForStamp,
  STAMP_RADIUS_METERS,
} from "@/lib/stampProgress";
import type { City, Spot, Stamp } from "@/lib/types";

type Location = Awaited<ReturnType<typeof locateForStamp>>;

/**
 * 公開対象と本人の収集状態を分離し、操作時の現在地を確認する。
 * @returns 公開マップ情報、本人の進捗、位置取得・収集・再読込操作
 * @example const collection = useStampCollection();
 */
export function useStampCollection() {
  const { user, status } = useAuthSession();
  const identity = status === "authenticated" ? (user?.id ?? null) : null;
  const [spots, setSpots] = useState<Spot[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isSample, setIsSample] = useState(true);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState<
    string | null | undefined
  >();
  const [location, setLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const [message, setMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPublicLoading(true);
    setPublicError(null);
    fetchStampCatalog()
      .then((catalog) => {
        if (!cancelled) {
          setSpots(catalog.spots);
          setCities(catalog.cities);
          setIsSample(catalog.isSample);
        }
      })
      .catch(() => {
        if (!cancelled)
          setPublicError(
            "対象スポットを読み込めませんでした。もう一度お試しください。",
          );
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  useEffect(() => {
    const current = ++generation.current;
    busyRef.current = false;
    setBusy(false);
    setLoadedIdentity(undefined);
    setStamps([]);
    setPrivateError(null);
    setLocation(null);
    setLocationError(null);
    setMessage(null);
    if (status !== "loading") {
      (identity ? fetchUserStamps(identity) : Promise.resolve([]))
        .then((records) => {
          if (generation.current === current) setStamps(records);
        })
        .catch(() => {
          if (generation.current === current)
            setPrivateError(
              "本人のスタンプを読み込めませんでした。進捗は未確認です。公開マップは引き続き閲覧できます。",
            );
        })
        .finally(() => {
          if (generation.current === current) setLoadedIdentity(identity);
        });
    }
    return () => {
      generation.current += 1;
    };
  }, [identity, status, revision]);

  const personalReady =
    Boolean(identity) &&
    status !== "loading" &&
    loadedIdentity === identity &&
    !privateError;
  const visibleStamps = personalReady && !isSample ? stamps : [];
  const progress = buildStampProgress(spots, cities, visibleStamps);
  const visibleLocation =
    loadedIdentity === identity && status !== "loading" ? location : null;
  const nearby = visibleLocation
    ? filterNearby(
        progress.targets,
        visibleLocation.lat,
        visibleLocation.lng,
        STAMP_RADIUS_METERS,
      )
    : [];

  /**
   * 現在地を明示操作で取得する。閲覧だけでは許可を要求しない。
   * @returns 取得完了
   * @example await requestLocation();
   */
  async function requestLocation(): Promise<void> {
    if (busyRef.current) return;
    const current = generation.current;
    busyRef.current = true;
    setBusy(true);
    setLocation(null);
    setLocationError(null);
    setMessage(null);
    try {
      const next = await locateForStamp();
      if (generation.current === current) setLocation(next);
    } catch (error) {
      if (generation.current === current)
        setLocationError(
          error instanceof Error
            ? error.message
            : "位置情報を取得できませんでした。",
        );
    } finally {
      if (generation.current === current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  /**
   * 現在地を再取得し、対象スポットの範囲内なら本人APIへ保存する。
   * @param spotId - 対象スポットID
   * @returns 保存処理の完了
   * @example await collect(1);
   */
  async function collect(spotId: number): Promise<void> {
    const spot = progress.targets.find((target) => target.id === spotId);
    if (
      !identity ||
      !personalReady ||
      isSample ||
      publicLoading ||
      publicError ||
      busyRef.current ||
      !spot ||
      progress.earnedIds.has(spotId)
    )
      return;
    const current = generation.current;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    setLocationError(null);
    try {
      const next = await locateForStamp();
      if (generation.current !== current) return;
      setLocation(next);
      if (next.accuracy > STAMP_RADIUS_METERS)
        throw new Error(
          "現在地の誤差が大きいため収集できません。屋外などで位置情報を取得し直してください。",
        );
      if (
        haversineDistance(next.lat, next.lng, spot.lat, spot.lng) >
        STAMP_RADIUS_METERS
      )
        throw new Error(
          "スポットから200m以内で収集できます。現在地を確認して、近くでお試しください。",
        );
      const record = await createStamp(identity, spotId);
      if (generation.current !== current) return;
      if (!record || record.spot_id !== spotId)
        throw new Error(
          "スタンプの保存を確認できませんでした。もう一度お試しください。",
        );
      setStamps((previous) =>
        previous.some((stamp) => stamp.spot_id === spotId)
          ? previous
          : [...previous, record],
      );
      setMessage({
        success: true,
        text: `${spot.name}のスタンプを獲得しました。`,
      });
    } catch (error) {
      if (generation.current === current)
        setMessage({
          success: false,
          text:
            error instanceof Error
              ? error.message
              : "保存できませんでした。再試行してください。",
        });
    } finally {
      if (generation.current === current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  /**
   * 公開対象と本人記録を再取得する。
   * @returns なし
   * @example reload();
   */
  function reload(): void {
    setRevision((value) => value + 1);
  }

  return {
    progress,
    isSample,
    publicLoading,
    publicError,
    privateError: loadedIdentity === identity ? privateError : null,
    personalReady,
    authenticated: Boolean(identity),
    authLoading: status === "loading",
    location: visibleLocation,
    locationError: loadedIdentity === identity ? locationError : null,
    busy,
    message: loadedIdentity === identity ? message : null,
    nearby,
    requestLocation,
    collect,
    reload,
  };
}
