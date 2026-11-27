import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteOwnData } from "./DeleteOwnData";

const state = vi.hoisted(() => ({ identity: "A" as string | null, signOut: vi.fn() }));
vi.mock("@/components/auth/SessionProvider", () => ({ useAuthSession: () => ({
  user: state.identity ? { id: state.identity } : null,
  status: state.identity ? "authenticated" : "unauthenticated",
  signOut: state.signOut,
}) }));
const fetchMock = vi.fn();
beforeEach(() => {
  state.identity = "A";
  state.signOut.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ success: true })));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("本人データ削除画面", () => {
  it("ゲストにはログイン操作だけを表示する", () => {
    state.identity = null;
    render(<DeleteOwnData />);
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login?next=%2Faccount");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("キャンセルでは削除しない", () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<DeleteOwnData />);
    fireEvent.click(screen.getByRole("button", { name: "削除してログアウト" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
  });
  it("確認後に表示時の本人を送信し、成功後にログアウトする", async () => {
    render(<DeleteOwnData />);
    fireEvent.click(screen.getByRole("button", { name: "削除してログアウト" }));
    await waitFor(() => expect(state.signOut).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.objectContaining({
      method: "DELETE", headers: { "Content-Type": "application/json", "x-session-user": "A" },
      body: JSON.stringify({ confirmation: "delete" }),
    }));
  });
  it("失敗ではログアウトせず再試行できる", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    render(<DeleteOwnData />);
    fireEvent.click(screen.getByRole("button", { name: "削除してログアウト" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("削除結果を確認できません");
    expect(state.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "削除してログアウト" })).toBeEnabled();
  });
  it("ログアウト失敗後の再試行は再削除しない", async () => {
    state.signOut.mockRejectedValueOnce(new Error("offline"));
    render(<DeleteOwnData />);
    fireEvent.click(screen.getByRole("button", { name: "削除してログアウト" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("データは削除しました");
    fireEvent.click(screen.getByRole("button", { name: "ログアウトを再試行" }));
    await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("送信中の連打を抑え、利用者変更後に旧処理からログアウトしない", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    const view = render(<DeleteOwnData />);
    const button = screen.getByRole("button", { name: "削除してログアウト" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledOnce();
    state.identity = "B";
    view.rerender(<DeleteOwnData />);
    await act(async () => { resolve(new Response(JSON.stringify({ success: true }))); });
    expect(state.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "削除してログアウト" })).toBeEnabled();
  });
});
