"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { GUEST_FAVORITES_KEY } from "@/lib/config";
import {
  addFavorite,
  ensurePublicUser,
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
}

/**
 * guest favorites を削除する。
 *
 * @returns なし
 * @example
 * clearGuestFavoriteIds();
 */
function clearGuestFavoriteIds(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_FAVORITES_KEY);
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

      if (!user) {
        const guestIds = readGuestFavoriteIds();
        const spots = await fetchSpots();
        if (!cancelled) {
          setFavoriteIds(guestIds);
          setFavoriteSpots(sortFavoriteSpotsByIds(spots, guestIds));
          setIsReady(true);
        }
        return;
      }

      const publicUser = await ensurePublicUser(user.id, user.email ?? "");
      if (!publicUser) {
        if (!cancelled) {
          setFavoriteIds([]);
          setFavoriteSpots([]);
          setIsReady(true);
        }
        return;
      }

      const guestIds = readGuestFavoriteIds();
      const mergedFavorites =
        guestIds.length > 0
          ? await mergeFavorites(publicUser.id, guestIds)
          : await fetchUserFavorites(publicUser.id);
      const spots = await fetchSpots();

      if (!cancelled) {
        const ids = mergedFavorites.map((favorite) => favorite.spot_id);
        setFavoriteIds(ids);
        setFavoriteSpots(sortFavoriteSpotsByIds(spots, ids));
        setIsReady(true);
      }

      if (guestIds.length > 0) {
        clearGuestFavoriteIds();
      }
    }

    loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [status, user]);

  /**
   * 指定スポットがお気に入り済みか返す。
   *
   * @param spotId - spot id
   * @returns お気に入り済みなら true
   * @example
   * isFavorite(10);
   */
  function isFavorite(spotId: number): boolean {
    return favoriteIds.includes(spotId);
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
    const nextIsFavorite = !favoriteIds.includes(spotId);

    if (!user) {
      const nextIds = nextIsFavorite
        ? [...favoriteIds, spotId]
        : favoriteIds.filter((id) => id !== spotId);
      writeGuestFavoriteIds(nextIds);
      setFavoriteIds(nextIds);

      if (nextIsFavorite) {
        const spots = await fetchSpots();
        setFavoriteSpots(sortFavoriteSpotsByIds(spots, nextIds));
      } else {
        setFavoriteSpots((current) => current.filter((spot) => spot.id !== spotId));
      }

      return nextIsFavorite;
    }

    const publicUser = await ensurePublicUser(user.id, user.email ?? "");
    if (!publicUser) return favoriteIds.includes(spotId);

    if (nextIsFavorite) {
      const inserted = await addFavorite(publicUser.id, spotId);
      if (!inserted) return false;
      const spots = await fetchSpots();
      const nextIds = [...favoriteIds, spotId];
      setFavoriteIds(nextIds);
      setFavoriteSpots(sortFavoriteSpotsByIds(spots, nextIds));
      return true;
    }

    const removed = await removeFavorite(publicUser.id, spotId);
    if (!removed) return true;
    const nextIds = favoriteIds.filter((id) => id !== spotId);
    setFavoriteIds(nextIds);
    setFavoriteSpots((current) => current.filter((spot) => spot.id !== spotId));
    return false;
  }

  return {
    favoriteIds,
    favoriteSpots,
    isReady,
    isAuthenticated: Boolean(user),
    isFavorite,
    toggleFavorite,
  };
}
