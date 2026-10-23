import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFavorites } from "./useFavorites";
import { GUEST_FAVORITES_KEY } from "@/lib/config";
import type { Spot } from "@/lib/types";

const session = vi.fn();
const api = vi.hoisted(() => ({
  addFavorite: vi.fn(),
  fetchSpots: vi.fn(),
  fetchUserFavorites: vi.fn(),
  mergeFavorites: vi.fn(),
  removeFavorite: vi.fn(),
}));
vi.mock("@/components/auth/SessionProvider", () => ({
  useAuthSession: () => session(),
}));
vi.mock("@/lib/supabaseClient", () => api);
const spots: Spot[] = [1, 2, 3].map((id) => ({
  id,
  name: `スポット${id}`,
  description: "旅先の説明",
  city_id: 1,
  genre_id: 1,
  lat: 39.7,
  lng: 141.1,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.localStorage.clear();
  session.mockReturnValue({ user: null, status: "unauthenticated" });
  api.fetchSpots.mockResolvedValue(spots);
  api.fetchUserFavorites.mockResolvedValue([]);
  api.addFavorite.mockResolvedValue({ spot_id: 1 });
  api.removeFavorite.mockResolvedValue(true);
  api.mergeFavorites.mockResolvedValue([1, 2]);
});

describe("useFavoritesのサンプルと本人データの分離", () => {
  it("ゲストは公開サンプルのみ読み、旧保存を変更せず、保存操作をAPIへ送信しない", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[2]");
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.sampleSpots).toEqual(spots);
    expect(result.current.favoriteIds).toEqual([]);
    expect(result.current.legacySpots).toEqual([]);
    await act(async () => {
      expect(await result.current.toggleFavorite(1)).toBe(false);
      await result.current.importLegacyFavorites();
    });
    expect(api.fetchUserFavorites).not.toHaveBeenCalled();
    expect(api.addFavorite).not.toHaveBeenCalled();
    expect(api.mergeFavorites).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[2]");
    expect(
      localStorage.getItem(`${GUEST_FAVORITES_KEY}:sync-owner`),
    ).toBeNull();
  });

  it("ログインだけでは旧保存を送信せず、本人の空一覧と移行候補を分ける", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[2,1,2]");
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(api.fetchUserFavorites).toHaveBeenCalledWith("A");
    expect(result.current.favoriteIds).toEqual([]);
    expect(result.current.sampleSpots).toEqual([]);
    expect(result.current.legacySpots.map((spot) => spot.id)).toEqual([2, 1]);
    expect(api.mergeFavorites).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[2,1,2]");
  });

  it("明示した追加だけを送り、成功後も元の保存を保持する", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[2,1,3]");
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.fetchUserFavorites.mockResolvedValue([{ spot_id: 3 }]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    expect(api.mergeFavorites).toHaveBeenCalledWith("A", [2, 1]);
    expect(result.current.favoriteIds).toEqual([3, 2, 1]);
    expect(result.current.legacySpots).toEqual([]);
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[2,1,3]");
    expect(localStorage.getItem(`${GUEST_FAVORITES_KEY}:sync-owner`)).toBe("A");
  });

  it("取り込み後に削除して再読込しても、元のバックアップを再取り込み候補にしない", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1,2]");
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.mergeFavorites.mockResolvedValue([1]);
    const { result, unmount } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    await act(async () => {
      await result.current.toggleFavorite(1);
    });
    expect(result.current.favoriteIds).toEqual([]);
    expect(result.current.legacySpots.map((spot) => spot.id)).toEqual([2]);
    unmount();
    const reloaded = renderHook(() => useFavorites());
    await waitFor(() => expect(reloaded.result.current.isReady).toBe(true));
    expect(reloaded.result.current.legacySpots.map((spot) => spot.id)).toEqual([
      2,
    ]);
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1,2]");
    await act(async () => {
      await reloaded.result.current.importLegacyFavorites();
    });
    expect(api.mergeFavorites).toHaveBeenLastCalledWith("A", [2]);
  });

  it("取り込み記録はアカウントごとに分離する", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    localStorage.setItem(`${GUEST_FAVORITES_KEY}:imported:A`, "[1]");
    session.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.legacySpots.map((spot) => spot.id)).toEqual([1]);
  });

  it("端末への記録失敗を伝え、確認できた本人保存は維持する", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key.includes(":imported:")) throw new Error("Quota exceeded");
      original.call(this, key, value);
    });
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    expect(result.current.favoriteIds).toEqual([1]);
    expect(result.current.legacySpots).toEqual([]);
    expect(result.current.error).toContain(
      "取り込み記録を保存できませんでした",
    );
  });

  it("失敗・部分成功でも未確認のIDを保存済みにせず、元データを残す", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1,2]");
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.mergeFavorites
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce([1]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    expect(result.current.favoriteIds).toEqual([]);
    expect(result.current.error).toContain("元データは保持");
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    expect(result.current.favoriteIds).toEqual([1]);
    expect(result.current.legacySpots.map((spot) => spot.id)).toEqual([2]);
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1,2]");
  });

  it("別アカウントの旧保存は表示も送信もしない", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    localStorage.setItem(`${GUEST_FAVORITES_KEY}:sync-owner`, "A");
    session.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
    api.fetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.legacySpots).toEqual([]);
    expect(result.current.hasOtherLegacyOwner).toBe(true);
    expect(result.current.favoriteIds).toEqual([2]);
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    expect(api.mergeFavorites).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1]");
  });

  it("追加直前に端末内容が変わっても、確認していないIDを送信しない", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1,2]");
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    expect(api.mergeFavorites).toHaveBeenCalledWith("A", [1]);
    expect(result.current.favoriteIds).toEqual([1]);
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1,2]");
  });

  it("1回の旧保存追加を100件に制限する", async () => {
    const many = Array.from({ length: 105 }, (_, index) => ({
      ...spots[0],
      id: index + 1,
    }));
    api.fetchSpots.mockResolvedValue(many);
    localStorage.setItem(
      GUEST_FAVORITES_KEY,
      JSON.stringify(many.map((spot) => spot.id)),
    );
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.legacySpots).toHaveLength(100);
    await act(async () => {
      await result.current.importLegacyFavorites();
    });
    expect(api.mergeFavorites.mock.calls[0][1]).toHaveLength(100);
    expect(JSON.parse(localStorage.getItem(GUEST_FAVORITES_KEY)!)).toHaveLength(
      105,
    );
  });

  it("本人の取得失敗を空一覧やサンプルで隠さず、再読み込みできる", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.fetchUserFavorites.mockRejectedValueOnce(new Error("503"));
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.sampleSpots).toEqual([]);
    await act(async () => {
      await result.current.toggleFavorite(1);
    });
    expect(api.addFavorite).not.toHaveBeenCalled();
    api.fetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.favoriteIds).toEqual([2]));
    expect(result.current.loadFailed).toBe(false);
  });

  it("認証確認中は旧一覧を隠し、ログアウト後はサンプルへ切り替える", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.fetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    const { result, rerender } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.favoriteIds).toEqual([2]));
    session.mockReturnValue({ user: { id: "A" }, status: "loading" });
    rerender();
    expect(result.current.isReady).toBe(false);
    expect(result.current.favoriteSpots).toEqual([]);
    session.mockReturnValue({ user: null, status: "unauthenticated" });
    rerender();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.favoriteSpots).toEqual([]);
    expect(result.current.sampleSpots).toEqual(spots);
  });

  it("A→B→Aの古い変更応答で最新の本人一覧を上書きしない", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    let resolve!: (value: unknown) => void;
    api.addFavorite.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, rerender } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let operation!: Promise<boolean>;
    act(() => {
      operation = result.current.toggleFavorite(1);
    });
    session.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
    rerender();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    api.fetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    rerender();
    await waitFor(() => expect(result.current.favoriteIds).toEqual([2]));
    await act(async () => {
      resolve({ spot_id: 1 });
      await operation;
    });
    expect(result.current.favoriteIds).toEqual([2]);
  });

  it("Aの旧保存追加応答をBへ反映せず、端末バックアップも消さない", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    let resolve!: (ids: number[]) => void;
    api.mergeFavorites.mockReturnValue(
      new Promise<number[]>((done) => {
        resolve = done;
      }),
    );
    const { result, rerender } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let operation!: Promise<void>;
    act(() => {
      operation = result.current.importLegacyFavorites();
    });
    api.fetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    session.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
    rerender();
    await waitFor(() => expect(result.current.favoriteIds).toEqual([2]));
    await act(async () => {
      resolve([1]);
      await operation;
    });
    expect(result.current.favoriteIds).toEqual([2]);
    expect(result.current.legacySpots).toEqual([]);
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1]");
  });

  it("同時クリックを1操作に制限し、削除失敗を一覧へ反映しない", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.fetchUserFavorites.mockResolvedValue([{ spot_id: 1 }]);
    api.removeFavorite.mockRejectedValue(new Error("503"));
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => {
      await Promise.all([
        result.current.toggleFavorite(1),
        result.current.toggleFavorite(1),
      ]);
    });
    expect(api.removeFavorite).toHaveBeenCalledTimes(1);
    expect(result.current.favoriteIds).toEqual([1]);
  });
});
