import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FavoriteToggleButton } from "./FavoriteToggleButton";

const favorites = vi.fn();
vi.mock("@/hooks/useFavorites", () => ({ useFavorites: () => favorites() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/spots/1" }));

describe("スポットの保存導線", () => {
  it("未ログインなら元のスポットへ戻るログインリンクを表示する", () => {
    favorites.mockReturnValue({
      isReady: true,
      isAuthenticated: false,
      isFavorite: () => false,
    });
    render(<FavoriteToggleButton spotId={1} />);
    expect(
      screen.getByRole("link", { name: "ログインして保存" }),
    ).toHaveAttribute("href", "/login?next=%2Fspots%2F1");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("本人の保存を読み込めない間は状態変更を受け付けない", () => {
    favorites.mockReturnValue({
      isReady: true,
      isAuthenticated: true,
      loadFailed: true,
      isFavorite: () => false,
    });
    render(<FavoriteToggleButton spotId={1} />);
    expect(
      screen.getByRole("button", { name: "お気に入りに残す" }),
    ).toBeDisabled();
  });
});
