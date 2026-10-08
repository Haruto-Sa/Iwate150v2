import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmedExternalLink, resolveExternalDestination } from "./ExternalNavigation";

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  // jsdomではnative dialogのtop layerを再現できないため、表示状態のみ補完する。
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("external navigation confirmation", () => {
  it("確認前に外部遷移リンクを表示せず、キャンセルで終了・フォーカスを復元する", async () => {
    const user = userEvent.setup();
    render(<ConfirmedExternalLink href="https://example.com/place">関連リンク</ConfirmedExternalLink>);
    const trigger = screen.getByRole("button", { name: "関連リンク" });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "外部サイトへ移動します" })).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "外部サイトを開く" })).toHaveAttribute("href", "https://example.com/place");
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
    expect(document.body.style.position).toBe("fixed");
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.position).toBe("");
  });

  it("native cancelイベントで閉じ、再度開ける", async () => {
    const user = userEvent.setup();
    render(<ConfirmedExternalLink href="https://example.com">関連リンク</ConfirmedExternalLink>);
    await user.click(screen.getByRole("button", { name: "関連リンク" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "関連リンク" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "file:///tmp/test", "not a URL", "https://user:pass@example.com"])("不正URLを開かない: %s", async (href) => {
    render(<ConfirmedExternalLink href={href}>関連リンク</ConfirmedExternalLink>);
    await userEvent.click(screen.getByRole("button", { name: "関連リンク" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("HTTP(S)のURLを正規化する", () => {
    expect(resolveExternalDestination("https://example.com")).toEqual({ url: "https://example.com/", hostname: "example.com" });
    expect(resolveExternalDestination("http://example.com/place")?.url).toBe("http://example.com/place");
  });

  it("クリック前にフォーカスがない場合も起動ボタンへ戻す", () => {
    render(<ConfirmedExternalLink href="https://example.com">関連リンク</ConfirmedExternalLink>);
    const trigger = screen.getByRole("button", { name: "関連リンク" });
    expect(trigger).not.toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(trigger).toHaveFocus();
  });
});
