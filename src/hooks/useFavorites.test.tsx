import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFavorites } from "@/hooks/useFavorites";
import { GUEST_FAVORITES_KEY } from "@/lib/config";
import type { Favorite, Spot, User } from "@/lib/types";

const mockUseAuthSession = vi.fn();
const mockAddFavorite = vi.fn();
const mockEnsurePublicUser = vi.fn();
const mockFetchSpots = vi.fn();
const mockFetchUserFavorites = vi.fn();
const mockMergeFavorites = vi.fn();
const mockRemoveFavorite = vi.fn();

vi.mock("@/components/auth/SessionProvider", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  addFavorite: (...args: unknown[]) => mockAddFavorite(...args),
  ensurePublicUser: (...args: unknown[]) => mockEnsurePublicUser(...args),
  fetchSpots: (...args: unknown[]) => mockFetchSpots(...args),
  fetchUserFavorites: (...args: unknown[]) => mockFetchUserFavorites(...args),
  mergeFavorites: (...args: unknown[]) => mockMergeFavorites(...args),
  removeFavorite: (...args: unknown[]) => mockRemoveFavorite(...args),
}));

const spots: Spot[] = [
  { id: 1, name: "盛岡城跡公園", description: "桜の名所", city_id: 1, genre_id: 1, lat: 39.7, lng: 141.1 },
  { id: 2, name: "龍泉洞", description: "透明な地底湖", city_id: 3, genre_id: 2, lat: 39.8, lng: 141.7 },
];

const publicUser: User = {
  id: 9,
  auth_id: "auth-user",
  email: "traveler@example.com",
  role: "user",
  display_name: "traveler",
  created_at: "2026-03-19T00:00:00Z",
};

describe("useFavorites", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseAuthSession.mockReset();
    mockAddFavorite.mockReset();
    mockEnsurePublicUser.mockReset();
    mockFetchSpots.mockReset();
    mockFetchUserFavorites.mockReset();
    mockMergeFavorites.mockReset();
    mockRemoveFavorite.mockReset();

    mockFetchSpots.mockResolvedValue(spots);
    mockAddFavorite.mockResolvedValue({ id: 1, user_id: 9, spot_id: 1, created_at: "2026-03-19T00:00:00Z" });
    mockRemoveFavorite.mockResolvedValue(true);
  });

  it("未ログイン時は localStorage に保存してトグルできる", async () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
      status: "unauthenticated",
    });

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    await act(async () => {
      await result.current.toggleFavorite(1);
    });

    expect(result.current.isFavorite(1)).toBe(true);
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1]");

    await act(async () => {
      await result.current.toggleFavorite(1);
    });

    expect(result.current.isFavorite(1)).toBe(false);
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[]");
  });

  it("ログイン時に guest favorites を Supabase へマージして localStorage を消す", async () => {
    const mergedFavorites: Favorite[] = [
      { id: 1, user_id: 9, spot_id: 2, created_at: "2026-03-19T00:00:00Z" },
      { id: 2, user_id: 9, spot_id: 1, created_at: "2026-03-19T00:00:01Z" },
    ];

    window.localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify([2, 1]));
    mockUseAuthSession.mockReturnValue({
      user: { id: "auth-user", email: "traveler@example.com", name: "Traveler", role: "user" },
      status: "authenticated",
    });
    mockEnsurePublicUser.mockResolvedValue(publicUser);
    mockMergeFavorites.mockResolvedValue([2, 1]);
    mockFetchUserFavorites.mockResolvedValue(mergedFavorites);

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(mockEnsurePublicUser).not.toHaveBeenCalled();
    expect(mockMergeFavorites).toHaveBeenCalledWith("auth-user", [2, 1]);
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBeNull();
    expect(result.current.favoriteIds).toEqual([2, 1]);
    expect(result.current.favoriteSpots.map((spot) => spot.id)).toEqual([2, 1]);
  });
  it("同期が失敗しても端末データを残し本人の保存済み一覧を表示する", async () => {
    window.localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    mockUseAuthSession.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    mockMergeFavorites.mockRejectedValue(new Error("503"));
    mockFetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1]");
    expect(result.current.favoriteIds).toEqual([2]);
    expect(result.current.error).toContain("同期できません");
  });

  it("部分成功では保存を確認できた分だけ端末から削除する", async () => {
    window.localStorage.setItem(GUEST_FAVORITES_KEY, "[1,2]");
    mockUseAuthSession.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    mockMergeFavorites.mockResolvedValue([1]);
    mockFetchUserFavorites.mockResolvedValue([{ spot_id: 1 }]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[2]");
  });

  it("同期中に追加された端末データを上書きしない", async () => {
    window.localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    mockUseAuthSession.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    mockMergeFavorites.mockImplementation(async () => {
      window.localStorage.setItem(GUEST_FAVORITES_KEY, "[1,2]");
      return [1];
    });
    mockFetchUserFavorites.mockResolvedValue([{ spot_id: 1 }]);
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1,2]");
  });

  it("旧Aの同期応答をBの画面へ反映せずゲスト記録も消さない", async () => {
    window.localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    let resolve!: (ids: number[]) => void;
    mockMergeFavorites.mockReturnValue(new Promise<number[]>((done) => { resolve = done; }));
    mockFetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    mockUseAuthSession.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    const { result, rerender } = renderHook(() => useFavorites());
    await waitFor(() => expect(mockMergeFavorites).toHaveBeenCalled());
    mockUseAuthSession.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
    rerender();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => resolve([1]));
    expect(result.current.favoriteIds).toEqual([2]);
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBe("[1]");
    expect(mockMergeFavorites).toHaveBeenCalledTimes(1);
  });

  it("ゲスト記録を全削除すると旧同期先を解除する", async () => {
    window.localStorage.setItem(GUEST_FAVORITES_KEY, "[1]");
    window.localStorage.setItem(`${GUEST_FAVORITES_KEY}:sync-owner`, "A");
    mockUseAuthSession.mockReturnValue({ user: null, status: "unauthenticated" });
    const { result } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => { await result.current.toggleFavorite(1); });
    expect(window.localStorage.getItem(`${GUEST_FAVORITES_KEY}:sync-owner`)).toBeNull();
  });

  it("A→B→Aで旧操作の遅延応答が最新一覧を上書きしない", async () => {
    mockUseAuthSession.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    mockFetchUserFavorites.mockResolvedValue([]);
    let resolve!: (value: unknown) => void;
    mockAddFavorite.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(() => useFavorites());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let operation!: Promise<boolean>;
    act(() => { operation = result.current.toggleFavorite(1); });
    mockUseAuthSession.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
    rerender();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    mockFetchUserFavorites.mockResolvedValue([{ spot_id: 2 }]);
    mockUseAuthSession.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    rerender();
    await waitFor(() => expect(result.current.favoriteIds).toEqual([2]));
    await act(async () => { resolve({ spot_id: 1 }); await operation; });
    expect(result.current.favoriteIds).toEqual([2]);
  });

});
