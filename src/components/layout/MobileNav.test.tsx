import type { AnchorHTMLAttributes } from "react";
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
    expect(screen.getByRole("link", { name: "キャラクター" })).toHaveAttribute("href", "/character");
    expect(screen.queryByRole("button", { name: "その他" })).not.toBeInTheDocument();
  });

  it("カメラ以外の選択中タブでも同じ強調を出す", () => {
    mockUsePathname.mockReturnValue("/map");
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: "地図" }).className).toContain("bg-[#0f3a3a]");
    expect(screen.getByRole("link", { name: "カメラ" }).className).not.toContain("bg-[#0f3a3a]");
  });

  it("キャラクターを選択中の下部タブとして表示する", () => {
    mockUsePathname.mockReturnValue("/character");
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: "キャラクター" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "キャラクター" }).className).toContain("bg-[#0f3a3a]");
  });

  it("Studioでは下部ナビを表示しない", () => {
    mockUsePathname.mockReturnValue("/studio/spots");
    const { container } = render(<MobileNav />);
    expect(container).toBeEmptyDOMElement();
  });
});
