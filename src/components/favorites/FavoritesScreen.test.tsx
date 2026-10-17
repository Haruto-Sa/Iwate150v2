import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesScreen } from "./FavoritesScreen";
import type { Spot } from "@/lib/types";

const mockUseFavorites = vi.fn();
const toggleFavorite = vi.fn();
const importLegacyFavorites = vi.fn();
const reload = vi.fn();
vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => mockUseFavorites(),
}));
vi.mock("@/lib/storageSignedClient", () => ({
  useResolvedStorageUrls: () => new Map(),
}));
const spot: Spot = {
  id: 1,
  name: "盛岡城跡公園",
  description: "旅先の説明",
  city_id: 1,
  genre_id: 1,
  lat: 39.7,
  lng: 141.1,
};
const base = {
  favoriteIds: [],
  favoriteSpots: [],
  sampleSpots: [],
  legacySpots: [],
  hasOtherLegacyOwner: false,
  isReady: true,
  isMutating: false,
  loadFailed: false,
  error: null,
  notice: null,
  isAuthenticated: true,
  toggleFavorite,
  importLegacyFavorites,
  reload,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFavorites.mockReturnValue(base);
});

describe("FavoritesScreen", () => {
  it("ゲストのサンプルを本人の保存と明確に区別し、削除操作を表示しない", () => {
    mockUseFavorites.mockReturnValue({
      ...base,
      isAuthenticated: false,
      sampleSpots: [spot],
    });
    render(<FavoritesScreen />);
    expect(
      screen.getByRole("heading", { name: "お気に入りのサンプル" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/あなたが保存した内容ではありません/),
    ).toBeInTheDocument();
    expect(screen.getByText(spot.name)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /削除/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ログインして自分の一覧を作る" }),
    ).toHaveAttribute("href", "/login?next=%2Ffavorites");
  });

  it("本人の空一覧にはサンプルを混ぜず旅先への導線を表示する", () => {
    render(<FavoritesScreen />);
    expect(
      screen.getByText(
        "まだお気に入りはありません。スポット詳細から気になる場所を保存できます。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "お気に入りのサンプル" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "最初の旅先を探す" }),
    ).toHaveAttribute("href", "/search");
  });

  it("本人の保存は名前付き操作で削除できる", async () => {
    mockUseFavorites.mockReturnValue({
      ...base,
      favoriteIds: [1],
      favoriteSpots: [spot],
    });
    render(<FavoritesScreen />);
    await userEvent.click(
      screen.getByRole("button", { name: "盛岡城跡公園をお気に入りから削除" }),
    );
    expect(toggleFavorite).toHaveBeenCalledWith(1);
  });

  it("旧保存は内容を開くまで追加操作を表示せず、クリック時だけ移行する", async () => {
    mockUseFavorites.mockReturnValue({ ...base, legacySpots: [spot] });
    render(<FavoritesScreen />);
    expect(importLegacyFavorites).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /このアカウントに追加/ }),
    ).not.toBeVisible();
    await userEvent.click(screen.getByText("追加する内容を確認（1件）"));
    expect(screen.getByText(spot.name)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "表示中の1件をこのアカウントに追加" }),
    );
    expect(importLegacyFavorites).toHaveBeenCalledOnce();
  });

  it("取得失敗時には本人の空状態を表示せず再読み込みを案内する", async () => {
    mockUseFavorites.mockReturnValue({
      ...base,
      loadFailed: true,
      error: "読込失敗",
    });
    render(<FavoritesScreen />);
    expect(screen.getByRole("alert")).toHaveTextContent("読込失敗");
    expect(
      screen.queryByText(/まだお気に入りはありません/),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "もう一度読み込む" }),
    );
    expect(reload).toHaveBeenCalledOnce();
  });

  it("情報のない保存を空扱いせず、記録を保持していると説明する", () => {
    mockUseFavorites.mockReturnValue({ ...base, favoriteIds: [999] });
    render(<FavoritesScreen />);
    expect(
      screen.queryByText(/まだお気に入りはありません/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/保存した記録はそのまま保持/)).toBeInTheDocument();
  });
});
