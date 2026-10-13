"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { GUEST_FAVORITES_KEY } from "@/lib/config";
import {
  addFavorite,
  fetchSpots,
  fetchUserFavorites,
  mergeFavorites,
  removeFavorite,
} from "@/lib/supabaseClient";
import type { Spot } from "@/lib/types";

type FavoritesState = {
  favoriteIds: number[];
  favoriteSpots: Spot[];
  isReady: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isFavorite: (spotId: number) => boolean;
  toggleFavorite: (spotId: number) => Promise<boolean>;
};

/**
 * localStorage から guest favorites を読む。
 *
 * @returns spot id 配列
 * @example
 * readGuestFavoriteIds();
 */
function readGuestFavoriteIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is number => Number.isInteger(value) && value > 0))];
  } catch {
    return [];
  }
}

/**
 * guest favorites を localStorage へ保存する。
 *
 * @param spotIds - 保存する spot id 配列
 * @returns なし
 * @example
 * writeGuestFavoriteIds([1, 3, 9]);
 */
function writeGuestFavoriteIds(spotIds: number[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify([...new Set(spotIds)]));
  if (!spotIds.length) window.localStorage.removeItem(`${GUEST_FAVORITES_KEY}:sync-owner`);
}

/**
 * spot 配列を favoriteIds の順序にそろえる。
 *
 * @param spots - 全スポット配列
 * @param favoriteIds - お気に入りの spot id 配列
 * @returns favoriteIds 順に並べ替えたスポット配列
 * @example
 * sortFavoriteSpotsByIds(spots, [4, 1]);
 */
function sortFavoriteSpotsByIds(spots: Spot[], favoriteIds: number[]): Spot[] {
  const favoriteIdSet = new Set(favoriteIds);
  const spotMap = new Map(spots.map((spot) => [spot.id, spot] as const));
  return favoriteIds
    .filter((spotId) => favoriteIdSet.has(spotId))
    .map((spotId) => spotMap.get(spotId) ?? null)
    .filter((spot): spot is Spot => spot !== null);
}

/**
 * お気に入りの保存先を抽象化する。
 *
 * 未ログイン時は localStorage、ログイン時は Supabase を使い、
 * ログイン検知時は guest favorites を自動でマージする。
 *
 * @returns favorites 状態と操作
 * @example
 * const favorites = useFavorites();
 */
export function useFavorites(): FavoritesState {
  const { user, status } = useAuthSession();
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteSpots, setFavoriteSpots] = useState<Spot[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null | undefined>(undefined);
  const identity = user?.id ?? null;
  const activeIdentity = useRef(identity);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    activeIdentity.current = identity;
    generation.current += 1;
    busy.current = false;
  }, [identity]);

  useEffect(() => {
    let cancelled = false;

    /**
     * お気に入り一覧を読み込む。
     *
     * @returns なし
     * @example
     * await loadFavorites();
     */
    async function loadFavorites(): Promise<void> {
      if (status === "loading") return;

      setIsReady(false);
      setError(null);
      setFavoriteIds([]);
      setFavoriteSpots([]);
      try {
        const guestIds = readGuestFavoriteIds();
        let ids = guestIds;
        if (identity) {
          try {
            const ownerKey = `${GUEST_FAVORITES_KEY}:sync-owner`;
            const owner = window.localStorage.getItem(ownerKey);
            if (guestIds.length && (!owner || owner === identity)) {
              // 応答消失後に別の利用者へ再送しないよう、送信前に同期先を固定する。
              window.localStorage.setItem(ownerKey, identity);
              const snapshot = window.localStorage.getItem(GUEST_FAVORITES_KEY);
              const persisted = await mergeFavorites(identity, guestIds.slice(0, 100));
              if (cancelled) return;
              // 同期中の端末操作を上書きしない。変更があれば次回再試行する。
              if (window.localStorage.getItem(GUEST_FAVORITES_KEY) === snapshot &&
                  window.localStorage.getItem(ownerKey) === identity) {
                const confirmed = new Set(persisted);
                const remaining = guestIds.filter((id) => !confirmed.has(id));
                if (remaining.length) writeGuestFavoriteIds(remaining);
                else {
                  window.localStorage.removeItem(GUEST_FAVORITES_KEY);
                  window.localStorage.removeItem(ownerKey);
                }
              }
              if (guestIds.some((id) => !persisted.includes(id))) {
                setError("未同期のお気に入りは端末に保持しています。再読み込みで再試行できます。");
              }
            } else if (guestIds.length) {
              setError("別のアカウントへの未同期データは端末に保持しています。元のアカウントで再試行してください。");
            }
          } catch {
            if (!cancelled) setError("端末のお気に入りを同期できませんでした。未同期データは保持しています。");
          }
          if (cancelled) return;
          ids = (await fetchUserFavorites(identity)).map((favorite) => favorite.spot_id);
        }
        const spots = await fetchSpots();
        if (!cancelled) {
          setFavoriteIds(ids);
          setFavoriteSpots(sortFavoriteSpotsByIds(spots, ids));
        }
      } catch {
        if (!cancelled) setError("お気に入りを取得・保存できませんでした。未同期データは端末に保持しています。再読み込みしてお試しください。");
      } finally {
        if (!cancelled) { setLoadedIdentity(identity); setIsReady(true); }
      }
    }

    loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [status, identity]);

  /**
   * 指定スポットがお気に入り済みか返す。
   *
   * @param spotId - spot id
   * @returns お気に入り済みなら true
   * @example
   * isFavorite(10);
   */
  function isFavorite(spotId: number): boolean {
    return loadedIdentity === identity && favoriteIds.includes(spotId);
  }

  /**
   * お気に入りをトグルする。
   *
   * @param spotId - spot id
   * @returns トグル後の状態
   * @example
   * await toggleFavorite(10);
   */
  async function toggleFavorite(spotId: number): Promise<boolean> {
    const wasFavorite = favoriteIds.includes(spotId);
    if (busy.current || loadedIdentity !== identity || !isReady) return wasFavorite;
    busy.current = true;
    const operationGeneration = generation.current;
    const nextIsFavorite = !wasFavorite;
    try {
      setError(null);
      if (identity) {
        if (nextIsFavorite) {
          if (!await addFavorite(identity, spotId)) throw new Error("Save not confirmed");
        } else if (!await removeFavorite(identity, spotId)) throw new Error("Delete not confirmed");
      } else {
        const current = readGuestFavoriteIds();
        writeGuestFavoriteIds(nextIsFavorite ? [...current, spotId] : current.filter((id) => id !== spotId));
      }
      const spots = nextIsFavorite ? await fetchSpots() : [];
      if (activeIdentity.current !== identity || generation.current !== operationGeneration) return wasFavorite;
      const nextIds = nextIsFavorite ? [...new Set([...favoriteIds, spotId])] : favoriteIds.filter((id) => id !== spotId);
      setFavoriteIds(nextIds);
      if (nextIsFavorite) setFavoriteSpots(sortFavoriteSpotsByIds(spots, nextIds));
      else setFavoriteSpots((current) => current.filter((spot) => spot.id !== spotId));
      return nextIsFavorite;
    } catch {
      if (activeIdentity.current === identity && generation.current === operationGeneration) setError("お気に入りを保存できませんでした。再試行してください。");
      return wasFavorite;
    } finally { if (generation.current === operationGeneration) busy.current = false; }
  }

  return {
    favoriteIds: loadedIdentity === identity ? favoriteIds : [],
    favoriteSpots: loadedIdentity === identity ? favoriteSpots : [],
    isReady: isReady && loadedIdentity === identity,
    error: loadedIdentity === identity ? error : null,
    isAuthenticated: Boolean(user),
    isFavorite,
    toggleFavorite,
  };
}
