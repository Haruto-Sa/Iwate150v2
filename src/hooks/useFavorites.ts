"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { GUEST_FAVORITES_KEY } from "@/lib/config";
import {
  addFavorite,
  fetchStampCatalog,
  fetchUserFavorites,
  mergeFavorites,
  removeFavorite,
} from "@/lib/privateUserClient";
import type { Spot } from "@/lib/types";

const LEGACY_OWNER_KEY = `${GUEST_FAVORITES_KEY}:sync-owner`;
const IMPORT_BATCH_SIZE = 100;

/**
 * アカウントごとの旧保存取り込み記録キーを返す。
 * @param identity - 認証ユーザーID
 * @returns 端末バックアップと独立したキー
 * @example legacyImportedKey("user-A");
 */
function legacyImportedKey(identity: string): string {
  return `${GUEST_FAVORITES_KEY}:imported:${encodeURIComponent(identity)}`;
}

/**
 * 確認済みの取り込みIDを読む。破損した記録は候補を隠す根拠にしない。
 * @param identity - 認証ユーザーID
 * @returns このアカウントで取り込み済みのID
 * @example readImportedIds("user-A");
 */
function readImportedIds(identity: string): number[] {
  try {
    const values: unknown = JSON.parse(
      window.localStorage.getItem(legacyImportedKey(identity)) ?? "[]",
    );
    return Array.isArray(values)
      ? values.filter((id): id is number => Number.isSafeInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
}

type FavoritesState = {
  favoriteIds: number[];
  favoriteSpots: Spot[];
  sampleSpots: Spot[];
  legacySpots: Spot[];
  hasOtherLegacyOwner: boolean;
  isReady: boolean;
  isMutating: boolean;
  loadFailed: boolean;
  error: string | null;
  notice: string | null;
  isAuthenticated: boolean;
  isFavorite: (spotId: number) => boolean;
  toggleFavorite: (spotId: number) => Promise<boolean>;
  importLegacyFavorites: () => Promise<void>;
  reload: () => void;
};

/**
 * 以前の端末保存を読み取る。サンプルとは別扱いにし、読込だけでは書換えない。
 * @returns 保存IDと旧同期先。ストレージを読めない場合は空
 * @example const previous = readLegacyFavorites();
 */
function readLegacyFavorites(): { ids: number[]; owner: string | null } {
  try {
    const raw = window.localStorage.getItem(GUEST_FAVORITES_KEY);
    const values: unknown = raw ? JSON.parse(raw) : [];
    return {
      ids: Array.isArray(values)
        ? [
            ...new Set(
              values.filter(
                (id): id is number => Number.isSafeInteger(id) && id > 0,
              ),
            ),
          ]
        : [],
      owner: window.localStorage.getItem(LEGACY_OWNER_KEY),
    };
  } catch {
    return { ids: [], owner: null };
  }
}

/**
 * 指定IDの順序で公開スポット情報を並べる。
 * @param spots - 公開スポット
 * @param ids - 表示順のID
 * @returns 公開情報の見つかったスポット
 * @example selectSpots(spots, [4, 1]);
 */
function selectSpots(spots: Spot[], ids: number[]): Spot[] {
  const byId = new Map(spots.map((spot) => [spot.id, spot]));
  return ids
    .map((id) => byId.get(id))
    .filter((spot): spot is Spot => Boolean(spot));
}

/**
 * サンプル、本人の保存、以前の端末保存を分けて扱う。
 * ゲストの操作では保存せず、ログインだけでも旧データを自動送信しない。
 * @returns 本人の一覧、読み取り専用のサンプル、明示操作と状態
 * @example const favorites = useFavorites();
 */
export function useFavorites(): FavoritesState {
  const { user, status } = useAuthSession();
  const identity = status === "authenticated" ? (user?.id ?? null) : null;
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [legacyIds, setLegacyIds] = useState<number[]>([]);
  const [importedIds, setImportedIds] = useState<number[]>([]);
  const [hasOtherLegacyOwner, setHasOtherLegacyOwner] = useState(false);
  const [loadedIdentity, setLoadedIdentity] = useState<
    string | null | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    busy.current = false;
    setIsMutating(false);
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    setNotice(null);
    setFavoriteIds([]);
    setSpots([]);
    setLegacyIds([]);
    setImportedIds([]);
    setHasOtherLegacyOwner(false);

    /**
     * 本人APIと公開情報を読み込む。ゲストでは公開情報のみ読む。
     * @returns 読み込み完了
     * @example await load();
     */
    async function load(): Promise<void> {
      if (status === "loading") return;
      try {
        const [records, catalog] = await Promise.all([
          identity ? fetchUserFavorites(identity) : Promise.resolve([]),
          fetchStampCatalog(),
        ]);
        if (cancelled) return;
        if (identity && catalog.isSample) throw new Error("Public catalog unavailable");
        const publicSpots = catalog.spots;
        setFavoriteIds([...new Set(records.map((record) => record.spot_id))]);
        setSpots(publicSpots);
        if (identity) {
          const previous = readLegacyFavorites();
          const otherOwner = Boolean(
            previous.owner && previous.owner !== identity,
          );
          setHasOtherLegacyOwner(otherOwner && previous.ids.length > 0);
          setLegacyIds(otherOwner ? [] : previous.ids);
          setImportedIds(readImportedIds(identity));
        }
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
          setError(
            "お気に入りを読み込めませんでした。時間をおいて、もう一度お試しください。",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadedIdentity(identity);
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
      generation.current += 1;
    };
  }, [identity, status, revision]);

  const isReady =
    status !== "loading" && !loading && loadedIdentity === identity;
  const visibleIds = isReady && identity ? favoriteIds : [];
  const legacySpots =
    isReady && identity
      ? selectSpots(
          spots,
          legacyIds.filter(
            (id) => !favoriteIds.includes(id) && !importedIds.includes(id),
          ),
        ).slice(0, IMPORT_BATCH_SIZE)
      : [];

  /**
   * 本人が保存済みかを返す。サンプルを保存済みとは判定しない。
   * @param spotId - スポットID
   * @returns 本人の保存状態
   * @example isFavorite(10);
   */
  function isFavorite(spotId: number): boolean {
    return visibleIds.includes(spotId);
  }

  /**
   * 本人の保存を変更する。ゲストや読込失敗時はAPIへ送信しない。
   * @param spotId - スポットID
   * @returns 確認できた保存状態
   * @example await toggleFavorite(10);
   */
  async function toggleFavorite(spotId: number): Promise<boolean> {
    const wasFavorite = visibleIds.includes(spotId);
    if (!identity || !isReady || loadFailed || busy.current) return wasFavorite;
    busy.current = true;
    setIsMutating(true);
    const operation = generation.current;
    try {
      setError(null);
      setNotice(null);
      const saved = wasFavorite
        ? await removeFavorite(identity, spotId)
        : await addFavorite(identity, spotId);
      if (!saved) throw new Error("Save not confirmed");
      if (generation.current !== operation) return wasFavorite;
      setFavoriteIds((current) =>
        wasFavorite
          ? current.filter((id) => id !== spotId)
          : [...new Set([...current, spotId])],
      );
      return !wasFavorite;
    } catch {
      if (generation.current === operation)
        setError("お気に入りを保存できませんでした。再試行してください。");
      return wasFavorite;
    } finally {
      if (generation.current === operation) {
        busy.current = false;
        setIsMutating(false);
      }
    }
  }

  /**
   * 表示して確認した旧端末保存だけを本人の一覧に追加する。
   * 旧データは成功・失敗にかかわらず保持し、1回100件まで処理する。
   * @returns 追加処理の完了
   * @example await importLegacyFavorites();
   */
  async function importLegacyFavorites(): Promise<void> {
    if (
      !identity ||
      !isReady ||
      loadFailed ||
      busy.current ||
      !legacySpots.length
    )
      return;
    busy.current = true;
    setIsMutating(true);
    const operation = generation.current;
    try {
      setError(null);
      setNotice(null);
      const latest = readLegacyFavorites();
      if (latest.owner && latest.owner !== identity)
        throw new Error("Different owner");
      const alreadyImported = readImportedIds(identity);
      const approved = legacySpots
        .map((spot) => spot.id)
        .filter(
          (id) => latest.ids.includes(id) && !alreadyImported.includes(id),
        );
      if (!approved.length) throw new Error("Device data changed");
      // 応答が消失しても別アカウントに再送しない。元の保存内容は変更しない。
      window.localStorage.setItem(LEGACY_OWNER_KEY, identity);
      const persisted = await mergeFavorites(identity, approved);
      const confirmed = approved.filter((id) => persisted.includes(id));
      const imported = [
        ...new Set([...readImportedIds(identity), ...confirmed]),
      ];
      let recorded = true;
      try {
        // 応答中にアカウントが切り替わっても、元の本人に紐づく記録だけ残す。
        window.localStorage.setItem(
          legacyImportedKey(identity),
          JSON.stringify(imported),
        );
      } catch {
        recorded = false;
      }
      if (generation.current !== operation) return;
      setImportedIds((current) => [...new Set([...current, ...imported])]);
      setFavoriteIds((current) => [...new Set([...current, ...confirmed])]);
      setLegacyIds(latest.ids);
      setNotice(
        `${confirmed.length}件をこのアカウントに追加しました。端末の元データも保持しています。`,
      );
      if (confirmed.length !== approved.length)
        setError(
          "追加できなかった保存があります。内容を確認して再試行してください。",
        );
      if (!recorded)
        setError(
          "追加結果は確認できましたが、端末の取り込み記録を保存できませんでした。再読込後に候補が再表示される場合があります。",
        );
    } catch {
      if (generation.current === operation)
        setError(
          "端末の保存を追加できませんでした。元データは保持しています。",
        );
    } finally {
      if (generation.current === operation) {
        busy.current = false;
        setIsMutating(false);
      }
    }
  }

  /**
   * 本人の一覧またはサンプルを再取得する。
   * @returns なし
   * @example reload();
   */
  function reload(): void {
    setRevision((current) => current + 1);
  }

  return {
    favoriteIds: visibleIds,
    favoriteSpots: selectSpots(spots, visibleIds),
    sampleSpots: isReady && !identity ? spots.slice(0, 3) : [],
    legacySpots,
    hasOtherLegacyOwner: isReady && Boolean(identity) && hasOtherLegacyOwner,
    isReady,
    isMutating: isReady && isMutating,
    loadFailed: isReady && loadFailed,
    error: isReady ? error : null,
    notice: isReady ? notice : null,
    isAuthenticated: Boolean(identity),
    isFavorite,
    toggleFavorite,
    importLegacyFavorites,
    reload,
  };
}
