import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { ONBOARDING_COMPLETED_KEY } from "@/lib/config";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname() }));

describe("OnboardingOverlay", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    window.resizeTo(390, 844);
    window.localStorage.clear();
    mockUsePathname.mockReturnValue("/");
  });

  it("初回メニューから機能を直接選べる", () => {
    render(<OnboardingOverlay />);
    expect(screen.getByRole("dialog", { name: "旅のメニュー" })).toBeVisible();
    expect(screen.getByRole("link", { name: "旅先を探す" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "写真を撮る" })).toHaveAttribute("href", "/camera");
    expect(screen.getByRole("link", { name: "スタンプを見る" })).toHaveAttribute("href", "/stamps");
  });

  it("機能を選ぶと既読を保存しメニューを閉じる", async () => {
    render(<OnboardingOverlay />);
    // jsdomでは遷移を止め、完了状態とメニュー終了を確認する。
    const link = screen.getByRole("link", { name: "写真を撮る" });
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(ONBOARDING_COMPLETED_KEY)).toBe("true");
  });

  it("閉じるだけでも完了状態を保存する", async () => {
    render(<OnboardingOverlay />);
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(ONBOARDING_COMPLETED_KEY)).toBe("true");
  });

  it("完了済みなら表示しない", () => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    render(<OnboardingOverlay />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("管理画面では表示しない", () => {
    mockUsePathname.mockReturnValue("/studio");
    render(<OnboardingOverlay />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("PCでもページ単位で表示し、閉じた後ヘルプから再表示できる", async () => {
    window.resizeTo(1280, 800);
    mockUsePathname.mockReturnValue("/camera");
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    render(<OnboardingOverlay />);
    expect(screen.getByRole("dialog", { name: "カメラの使い方" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "撮影を始める" }));
    expect(localStorage.getItem("voja_page_guide:/camera")).toBe("true");
    expect(localStorage.getItem("voja_page_guide:/search")).toBeNull();
    expect(screen.getByRole("button", { name: "使い方" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "使い方" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使い方" })).toHaveFocus();
  });

  it("経路が変わると次のページの案内を表示する", async () => {
    mockUsePathname.mockReturnValue("/search");
    const view = render(<OnboardingOverlay />);
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    mockUsePathname.mockReturnValue("/favorites");
    view.rerender(<OnboardingOverlay />);
    expect(screen.getByRole("dialog", { name: "お気に入りの使い方" })).toBeVisible();
    expect(screen.getByText(/ログイン後/)).toBeVisible();
  });

});
