import type { AnchorHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const mockPathname = vi.fn();
const mockSession = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
vi.mock("@/components/auth/SessionProvider", () => ({ useAuthSession: () => mockSession() }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props} onClick={(event) => { event.preventDefault(); props.onClick?.(event); }}>{children}</a>
  ),
}));

beforeEach(() => {
  mockPathname.mockReturnValue("/");
  mockSession.mockReturnValue({ user: null, signOut: vi.fn() });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Headerのその他メニュー", () => {
  it("ヘッダー内から補助メニューを開きCharacterとGuideを除外する", async () => {
    render(<Header />);
    const trigger = screen.getByRole("button", { name: "その他" });
    expect(trigger.closest("header")).not.toBeNull();
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "その他" });
    expect(within(dialog).getByRole("link", { name: /Stamps/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Favorites/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
    expect(within(dialog).queryByRole("link", { name: /Character|Guide/ })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(within(dialog).getByRole("link", { name: /Stamps/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("フォーカスのないクリックとEscape相当のcancel後も起動ボタンへ戻す", () => {
    render(<Header />);
    const trigger = screen.getByRole("button", { name: "その他" });
    fireEvent.click(trigger);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.position).toBe("");
  });

  it("ログイン済みならマイページとログアウトを提供する", async () => {
    const signOut = vi.fn();
    mockSession.mockReturnValue({ user: { id: "user1" }, signOut });
    render(<Header />);
    await userEvent.click(screen.getByRole("button", { name: "その他" }));
    expect(screen.getByRole("link", { name: "マイページ" })).toHaveAttribute("href", "/favorites");
    expect(screen.queryByRole("link", { name: "ログイン" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("その他配下だけを強調しCharacterは主要導線として扱う", () => {
    mockPathname.mockReturnValue("/character");
    const { rerender } = render(<Header />);
    expect(screen.getByRole("button", { name: "その他" }).className).not.toContain("bg-emerald-100");
    mockPathname.mockReturnValue("/stamps");
    rerender(<Header />);
    expect(screen.getByRole("button", { name: "その他" }).className).toContain("bg-emerald-100");
  });

  it("開いているメニューをルート変更時に閉じる", async () => {
    const { rerender } = render(<Header />);
    await userEvent.click(screen.getByRole("button", { name: "その他" }));
    mockPathname.mockReturnValue("/map");
    rerender(<Header />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    mockPathname.mockReturnValue("/");
    rerender(<Header />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Studio専用ヘッダーにその他は追加しない", () => {
    mockPathname.mockReturnValue("/studio/spots");
    render(<Header />);
    expect(screen.getByRole("link", { name: "Studio Workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "その他" })).not.toBeInTheDocument();
  });
});
