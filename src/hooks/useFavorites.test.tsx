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
    mockMergeFavorites.mockResolvedValue(mergedFavorites);
    mockFetchUserFavorites.mockResolvedValue(mergedFavorites);

    const { result } = renderHook(() => useFavorites());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(mockEnsurePublicUser).toHaveBeenCalledWith("auth-user", "traveler@example.com");
    expect(mockMergeFavorites).toHaveBeenCalledWith(9, [2, 1]);
    expect(window.localStorage.getItem(GUEST_FAVORITES_KEY)).toBeNull();
    expect(result.current.favoriteIds).toEqual([2, 1]);
    expect(result.current.favoriteSpots.map((spot) => spot.id)).toEqual([2, 1]);
  });
});
