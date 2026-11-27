import { act, fireEvent, render, screen } from "@testing-library/react";
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
  it.each([false, true])("サンプルは認証状態%sでも保存APIを呼ばない", (isAuthenticated) => {
    const toggleFavorite = vi.fn();
    favorites.mockReturnValue({ isReady: true, isAuthenticated, isFavorite: () => false, toggleFavorite });
    render(<FavoriteToggleButton spotId={5} isSample />);
    const button = screen.getByRole("button", { name: "サンプル（保存対象外）" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(toggleFavorite).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "ログインして保存" })).not.toBeInTheDocument();
  });

  it("実データは認証済みなら従来どおり保存できる", async () => {
    const toggleFavorite = vi.fn().mockResolvedValue(true);
    favorites.mockReturnValue({ isReady: true, isAuthenticated: true, isFavorite: () => false, toggleFavorite });
    render(<FavoriteToggleButton spotId={50} />);
    const button = screen.getByRole("button", { name: "お気に入りに残す" });
    expect(button).toBeEnabled();
    await act(async () => { fireEvent.click(button); });
    expect(toggleFavorite).toHaveBeenCalledWith(50);
  });

});
