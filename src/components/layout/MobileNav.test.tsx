import type { AnchorHTMLAttributes } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "@/components/layout/MobileNav";

const mockUsePathname = vi.fn();
const mockUseAuthSession = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/components/auth/SessionProvider", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

describe("MobileNav", () => {
  beforeEach(() => {
    window.resizeTo(390, 844);
    mockUsePathname.mockReturnValue("/");
    mockUseAuthSession.mockReturnValue({
      user: null,
      signOut: vi.fn(),
    });
  });

  it("現在タブだけを強く強調しつつ5項目ナビを表示する", () => {
    render(<MobileNav />);

    const homeLink = screen.getByRole("link", { name: "ホーム" });
    expect(screen.getByRole("link", { name: "ホーム" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "地図" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "検索" })).toBeInTheDocument();
    const cameraLink = screen.getByRole("link", { name: "カメラ" });
    expect(homeLink.className).toContain("bg-[#0f3a3a]");
    expect(homeLink.className).toContain("-mt-6");
    expect(cameraLink).toBeInTheDocument();
    expect(cameraLink.className).not.toContain("bg-[#0f3a3a]");
    expect(cameraLink.className).not.toContain("-mt-6");
    expect(screen.getByRole("button", { name: "その他" })).toBeInTheDocument();
  });

  it("カメラ以外の選択中タブでも同じ強調を出す", () => {
    mockUsePathname.mockReturnValue("/map");
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: "地図" }).className).toContain("bg-[#0f3a3a]");
    expect(screen.getByRole("link", { name: "カメラ" }).className).not.toContain("bg-[#0f3a3a]");
  });

  it("More シートを開いてメニューを閉じられる", async () => {
    render(<MobileNav />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("3D キャラクターを見る")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Character/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("More 配下ルートではその他をアクティブ表示する", async () => {
    mockUsePathname.mockReturnValue("/favorites");
    render(<MobileNav />);

    expect(screen.getByRole("button", { name: "その他" }).className).toContain("bg-emerald-100");
  });
});
