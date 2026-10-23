import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StampPage from "./page";
import type { Spot, Stamp } from "@/lib/types";

const session = vi.fn();
const api = vi.hoisted(() => ({
  fetchStampCatalog: vi.fn(),
  fetchUserStamps: vi.fn(),
  createStamp: vi.fn(),
}));
vi.mock("@/components/auth/SessionProvider", () => ({
  useAuthSession: () => session(),
}));
vi.mock("@/lib/supabaseClient", () => api);
vi.mock("next/dynamic", () => ({
  default: () => () => <div aria-label="スタンプ地図" />,
}));
const spot: Spot = {
  id: 1,
  name: "盛岡城跡公園",
  description: "公園",
  city_id: 1,
  genre_id: 1,
  lat: 39.7,
  lng: 141.1,
};
const stamp: Stamp = {
  id: 1,
  spot_id: 1,
  user_id: 1,
  created_at: "2026-01-01",
};
const geo = vi.fn();

/**
 * テスト用の現在地を返す。
 * @param lat - 緯度
 * @param accuracy - 誤差
 * @returns 位置情報
 * @example position();
 */
function position(lat = 39.7, accuracy = 10): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: 141.1, accuracy },
    timestamp: Date.now(),
  } as GeolocationPosition;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockReturnValue({ user: null, status: "unauthenticated" });
  api.fetchStampCatalog.mockResolvedValue({
    spots: [spot],
    cities: [
      { id: 1, name: "盛岡市" },
      { id: 2, name: "対象未登録の市町村" },
    ],
    isSample: false,
  });
  api.fetchUserStamps.mockResolvedValue([]);
  api.createStamp.mockResolvedValue(stamp);
  geo.mockImplementation((success: PositionCallback) => success(position()));
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: geo },
  });
});

describe("公開スタンプマップと本人収集", () => {
  it("サンプルIDが本人記録と一致しても進捗に使わず、収集・保存を止める", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.fetchStampCatalog.mockResolvedValue({
      spots: [spot],
      cities: [{ id: 1, name: "盛岡市" }],
      isSample: true,
    });
    api.fetchUserStamps.mockResolvedValue([stamp]);
    render(<StampPage />);
    expect(await screen.findByText(/サンプル表示中/)).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "位置情報を取得" }),
    );
    expect(
      await screen.findByRole("button", {
        name: `${spot.name}のスタンプを収集`,
      }),
    ).toBeDisabled();
    expect(screen.queryByText("1 / 1スポット取得")).toBeNull();
    await userEvent.click(screen.getByText("盛岡市"));
    expect(screen.queryAllByRole("link", { name: spot.name })).toHaveLength(0);
    expect(screen.getAllByText(spot.name)).toHaveLength(2);
    expect(api.createStamp).not.toHaveBeenCalled();
  });

  it("未ログインでも対象を閲覧でき、現在地取得だけでは記録もサンプルも保存しない", async () => {
    const user = userEvent.setup();
    render(<StampPage />);
    expect(
      await screen.findByRole("heading", { name: "岩手のスタンプマップ" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "ログインしてスタンプを集める" }),
    ).toHaveAttribute("href", "/login?next=%2Fstamps");
    expect(geo).not.toHaveBeenCalled();
    await user.click(screen.getByText("盛岡市"));
    expect(screen.getByRole("link", { name: spot.name })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "位置情報を取得" }));
    expect(
      await screen.findByRole("link", { name: "ログインして収集" }),
    ).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(api.fetchUserStamps).not.toHaveBeenCalled();
    expect(api.createStamp).not.toHaveBeenCalled();
  });

  it("本人取得が失敗しても公開対象を表示し、0件と誤認させず再取得できる", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.fetchUserStamps.mockRejectedValueOnce(new Error("503"));
    render(<StampPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("進捗は未確認");
    expect(
      screen.getByRole("heading", { name: "岩手のスタンプマップ" }),
    ).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "進捗をもう一度読み込む" }),
    );
    expect(await screen.findByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("収集時に現在地を再確認し、保存が確認された時だけ市町村の進捗を増やす", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    render(<StampPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "位置情報を取得" }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: `${spot.name}のスタンプを収集`,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "スタンプを獲得しました",
    );
    expect(geo).toHaveBeenCalledTimes(2);
    expect(api.createStamp).toHaveBeenCalledWith("A", 1);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByText("1 / 1スポット取得")).toBeVisible();
    expect(screen.getByText("対象未登録")).toBeVisible();
  });

  it.each([
    [40, 10, "200m以内"],
    [39.7, 500, "誤差が大きい"],
  ])(
    "現在地が変わった場合や精度不足では保存しない (%s, %s)",
    async (lat, accuracy, error) => {
      session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
      render(<StampPage />);
      await userEvent.click(
        await screen.findByRole("button", { name: "位置情報を取得" }),
      );
      geo.mockImplementation((success: PositionCallback) =>
        success(position(lat, accuracy)),
      );
      await userEvent.click(
        await screen.findByRole("button", {
          name: `${spot.name}のスタンプを収集`,
        }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(error);
      expect(api.createStamp).not.toHaveBeenCalled();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "0",
      );
    },
  );

  it("位置情報拒否を案内し、地図と対象一覧の閲覧を残す", async () => {
    geo.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1 } as GeolocationPositionError),
    );
    render(<StampPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "位置情報を取得" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "地図と対象一覧はそのまま閲覧できます",
    );
    expect(screen.getByText("盛岡市")).toBeVisible();
    expect(api.createStamp).not.toHaveBeenCalled();
  });

  it("保存失敗は進捗に反映せず、再試行できる", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    api.createStamp.mockRejectedValueOnce(new Error("保存できませんでした"));
    render(<StampPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "位置情報を取得" }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: `${spot.name}のスタンプを収集`,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "保存できませんでした",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await userEvent.click(
      screen.getByRole("button", { name: `${spot.name}のスタンプを収集` }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "スタンプを獲得しました",
    );
  });

  it("A→B→A切替後の古い保存応答を反映せず、重複クリックも送らない", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    let finish!: (record: Stamp) => void;
    api.createStamp.mockReturnValueOnce(
      new Promise<Stamp>((resolve) => {
        finish = resolve;
      }),
    );
    const { rerender } = render(<StampPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "位置情報を取得" }),
    );
    const button = await screen.findByRole("button", {
      name: `${spot.name}のスタンプを収集`,
    });
    await userEvent.dblClick(button);
    await waitFor(() => expect(api.createStamp).toHaveBeenCalledTimes(1));
    session.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
    rerender(<StampPage />);
    await waitFor(() => expect(api.fetchUserStamps).toHaveBeenCalledWith("B"));
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    rerender(<StampPage />);
    await act(async () => finish(stamp));
    expect(await screen.findByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.queryByText(/スタンプを獲得しました/)).toBeNull();
    expect(screen.queryByText(/現在地の推定誤差/)).toBeNull();
  });

  it("遅い位置情報応答を切替後のアカウントへ表示しない", async () => {
    session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
    let complete!: PositionCallback;
    geo.mockImplementation((success: PositionCallback) => {
      complete = success;
    });
    const { rerender } = render(<StampPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "位置情報を取得" }),
    );
    session.mockReturnValue({ user: null, status: "unauthenticated" });
    rerender(<StampPage />);
    await act(async () => complete(position()));
    expect(screen.queryByText(/現在地の推定誤差/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(api.createStamp).not.toHaveBeenCalled();
  });
});
