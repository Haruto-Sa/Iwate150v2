import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesScreen } from "@/components/favorites/FavoritesScreen";

const mockUseFavorites = vi.fn();
const mockToggleFavorite = vi.fn();

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => mockUseFavorites(),
}));

vi.mock("@/lib/storageSignedClient", () => ({
  useResolvedStorageUrls: () => new Map<string, string>(),
}));

describe("FavoritesScreen", () => {
  beforeEach(() => {
    mockToggleFavorite.mockReset();
    mockUseFavorites.mockReturnValue({
      favoriteIds: [1],
      favoriteSpots: [
        {
          id: 1,
          name: "盛岡城跡公園",
          description: "歴史ある公園です。",
          city_id: 1,
          genre_id: 1,
          lat: 39.7,
          lng: 141.1,
          image_path: null,
        },
      ],
      isReady: true,
      isAuthenticated: false,
      isFavorite: vi.fn(),
      toggleFavorite: mockToggleFavorite,
    });
  });

  it("未ログイン時は同期バナーを表示する", () => {
    render(<FavoritesScreen />);

    expect(screen.getByText("ログインすると同期できます")).toBeInTheDocument();
    expect(screen.getByText("盛岡城跡公園")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログインする" })).toBeInTheDocument();
  });

  it("一覧からお気に入りを削除できる", async () => {
    render(<FavoritesScreen />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(mockToggleFavorite).toHaveBeenCalledWith(1);
  });

  it("お気に入りが空なら次の行動を案内する", () => {
    mockUseFavorites.mockReturnValue({
      favoriteIds: [],
      favoriteSpots: [],
      isReady: true,
      isAuthenticated: true,
      isFavorite: vi.fn(),
      toggleFavorite: mockToggleFavorite,
    });

    render(<FavoritesScreen />);

    expect(screen.queryByText("ログインすると同期できます")).not.toBeInTheDocument();
    expect(
      screen.getByText("まだお気に入りはありません。スポット詳細から気になる場所を保存できます。")
    ).toBeInTheDocument();
  });
});
