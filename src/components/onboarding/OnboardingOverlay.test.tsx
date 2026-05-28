import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { ONBOARDING_COMPLETED_KEY } from "@/lib/config";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("OnboardingOverlay", () => {
  beforeEach(() => {
    window.resizeTo(390, 844);
    window.localStorage.clear();
    mockUsePathname.mockReturnValue("/");
  });

  it("モバイル幅で初回表示から完了まで進める", async () => {
    render(<OnboardingOverlay />);
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "スキップ" })).toBeInTheDocument();
    expect(screen.getByText("岩手の旅先を見つけよう")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("キャラクターと旅の思い出を")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("スタンプを集めて岩手マスターに")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "はじめる" }));
    expect(screen.queryByText("スタンプを集めて岩手マスターに")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ONBOARDING_COMPLETED_KEY)).toBe("true");
  });

  it("プログレスバーから任意の手順へ移動できる", async () => {
    render(<OnboardingOverlay />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /3ページ目へ移動/ }));
    expect(screen.getByText("スタンプを集めて岩手マスターに")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3ページ目へ移動/ })).toHaveAttribute(
      "aria-current",
      "step"
    );

    await user.click(screen.getByRole("button", { name: /1ページ目へ移動/ }));
    expect(screen.getByText("岩手の旅先を見つけよう")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1ページ目へ移動/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
  });

  it("完了済みなら表示しない", () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    render(<OnboardingOverlay />);

    expect(screen.queryByText("岩手の旅先を見つけよう")).not.toBeInTheDocument();
  });

  it("スキップでも完了状態を保存して閉じる", async () => {
    render(<OnboardingOverlay />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "スキップ" }));

    expect(screen.queryByText("岩手の旅先を見つけよう")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ONBOARDING_COMPLETED_KEY)).toBe("true");
  });

  it("管理画面では表示しない", () => {
    mockUsePathname.mockReturnValue("/studio");
    render(<OnboardingOverlay />);

    expect(screen.queryByText("岩手の旅先を見つけよう")).not.toBeInTheDocument();
  });
});
