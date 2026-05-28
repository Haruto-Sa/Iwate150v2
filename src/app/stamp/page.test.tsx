"use client";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StampPage from "@/app/stamp/page";
import type { Spot, Stamp, User } from "@/lib/types";

const mockUseAuthSession = vi.fn();
const mockFetchSpots = vi.fn();
const mockEnsurePublicUser = vi.fn();
const mockFetchUserStamps = vi.fn();
const mockCreateStamp = vi.fn();

vi.mock("@/components/auth/SessionProvider", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  fetchSpots: (...args: unknown[]) => mockFetchSpots(...args),
  ensurePublicUser: (...args: unknown[]) => mockEnsurePublicUser(...args),
  fetchUserStamps: (...args: unknown[]) => mockFetchUserStamps(...args),
  createStamp: (...args: unknown[]) => mockCreateStamp(...args),
}));

const mockUser: NonNullable<ReturnType<typeof mockUseAuthSession>["user"]> = {
  id: "auth-user",
  email: "traveler@example.com",
  name: "Traveler",
  role: "user",
};

const ensuredUser: User = {
  id: 10,
  auth_id: "auth-user",
  email: "traveler@example.com",
  role: "user",
  display_name: "Traveler",
  created_at: "2026-03-20T00:00:00Z",
};

const stampableSpot: Spot = {
  id: 1,
  name: "盛岡城跡公園",
  description: "桜が美しい公園です。",
  city_id: 1,
  genre_id: 1,
  lat: 39.7,
  lng: 141.1,
};

const earnedStamp: Stamp = {
  id: 101,
  user_id: 10,
  spot_id: 1,
  created_at: "2026-03-20T00:05:00Z",
};

/**
 * Geolocation モックを差し替える。
 *
 * @param getCurrentPosition - 差し込む実装
 * @returns なし
 * @example
 * installGeolocationMock(vi.fn());
 */
function installGeolocationMock(
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ) => void
): void {
  Object.defineProperty(window.navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
}

describe("StampPage", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockUseAuthSession.mockReset();
    mockFetchSpots.mockReset();
    mockEnsurePublicUser.mockReset();
    mockFetchUserStamps.mockReset();
    mockCreateStamp.mockReset();
    mockFetchSpots.mockResolvedValue([]);
    mockEnsurePublicUser.mockResolvedValue(null);
    mockFetchUserStamps.mockResolvedValue([]);
    mockCreateStamp.mockResolvedValue(null);
    installGeolocationMock(vi.fn());
  });

  it("shows a loading card while auth state is loading", () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
      status: "loading",
    });

    render(<StampPage />);

    expect(screen.getByText("スタンプラリーを読み込み中")).toBeInTheDocument();
  });

  it("shows login guidance when unauthenticated", async () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
      status: "unauthenticated",
    });

    render(<StampPage />);

    expect(await screen.findByText("Stamps start with login")).toBeInTheDocument();
    expect(screen.getByText("できること")).toBeInTheDocument();
  });

  it("shows an error card when initialization fails", async () => {
    mockUseAuthSession.mockReturnValue({ user: mockUser, status: "authenticated" });
    mockFetchSpots.mockRejectedValue(new Error("network error"));

    render(<StampPage />);

    expect(await screen.findByText("スタンプ情報を表示できません")).toBeInTheDocument();
  });

  it("lets an authenticated user locate a nearby spot and collect a stamp", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 39.7,
          longitude: 141.1,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    });
    installGeolocationMock(getCurrentPosition);
    mockUseAuthSession.mockReturnValue({ user: mockUser, status: "authenticated" });
    mockFetchSpots.mockResolvedValue([stampableSpot]);
    mockEnsurePublicUser.mockResolvedValue(ensuredUser);
    mockFetchUserStamps.mockResolvedValue([]);
    mockCreateStamp.mockResolvedValue(earnedStamp);

    render(<StampPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "位置情報を取得" }));

    expect(await screen.findByText("近くのスポット (1件)")).toBeInTheDocument();
    expect(screen.getByText("盛岡城跡公園")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "スタンプ" }));

    await waitFor(() => {
      expect(mockCreateStamp).toHaveBeenCalledWith(10, 1);
    });
    expect(await screen.findByText("スタンプを獲得しました！")).toBeInTheDocument();
    expect(screen.getByText("取得済み")).toBeInTheDocument();
  });

  it("shows a nearby-empty state when no stampable spot is within range", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 39.7,
          longitude: 141.1,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    });
    installGeolocationMock(getCurrentPosition);
    mockUseAuthSession.mockReturnValue({ user: mockUser, status: "authenticated" });
    mockFetchSpots.mockResolvedValue([
      {
        ...stampableSpot,
        id: 2,
        name: "龍泉洞",
        lat: 40.0,
        lng: 141.8,
      },
    ]);
    mockEnsurePublicUser.mockResolvedValue(ensuredUser);
    mockFetchUserStamps.mockResolvedValue([]);

    render(<StampPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "位置情報を取得" }));

    expect(await screen.findByText("近くにスポットがありません")).toBeInTheDocument();
    expect(
      screen.getByText("200m以内にスポットが見つかりませんでした。別の場所で試してみてください。")
    ).toBeInTheDocument();
  });

  it("shows a permission error when location access is denied", async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => {
        error?.({
          code: 1,
          message: "permission denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    );
    installGeolocationMock(getCurrentPosition);
    mockUseAuthSession.mockReturnValue({ user: mockUser, status: "authenticated" });
    mockFetchSpots.mockResolvedValue([stampableSpot]);
    mockEnsurePublicUser.mockResolvedValue(ensuredUser);
    mockFetchUserStamps.mockResolvedValue([]);

    render(<StampPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "位置情報を取得" }));

    expect(
      await screen.findByText("位置情報の許可が必要です。ブラウザ設定から許可してください。")
    ).toBeInTheDocument();
  });
});
