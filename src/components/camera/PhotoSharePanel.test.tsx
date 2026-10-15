import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoSharePanel } from "./PhotoSharePanel";

const share = vi.fn();
const canShare = vi.fn();
const revoke = vi.fn();
const build = async () => new Blob(["edited-photo"], { type: "image/png" });

beforeEach(() => {
  share.mockReset().mockResolvedValue(undefined);
  canShare.mockReset().mockReturnValue(true);
  revoke.mockReset();
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:photo") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
});
afterEach(() => cleanup());

/**
 * 写真準備が終わり共有ボタンが有効になるまで待つ。
 * @returns 有効な共有ボタン
 * @example const button = await readyButton();
 */
async function readyButton() {
  const button = await screen.findByRole("button", { name: "写真を添付して共有" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("PhotoSharePanel", () => {
  it("shares the prepared PNG synchronously from a click, without text-only fallback", async () => {
    render(<PhotoSharePanel build={build} hasPhoto />);
    const button = await readyButton();
    fireEvent.click(button);
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(["files"]);
    expect(data.files[0]).toMatchObject({ name: "iwate-memory.png", type: "image/png", size: 12 });
    await screen.findByText(/写真を共有先に渡しました/);
    expect(screen.getByRole("link", { name: "写真を保存" })).toHaveAttribute("download", "iwate-memory.png");
  });

  it("prevents repeated taps and recovers from cancellation", async () => {
    let rejectShare!: (error: Error) => void;
    share.mockImplementation(() => new Promise((_, reject) => { rejectShare = reject; }));
    render(<PhotoSharePanel build={build} hasPhoto />);
    const button = await readyButton();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(share).toHaveBeenCalledTimes(1);
    await act(async () => rejectShare(new DOMException("cancel", "AbortError")));
    expect(screen.getByRole("status")).toHaveTextContent("共有をキャンセルしました");
    expect(await readyButton()).toBeEnabled();
  });

  it.each(["NotAllowedError", "InvalidStateError", "DataError"])("shows actionable feedback for %s", async (name) => {
    share.mockRejectedValue(new DOMException("failed", name));
    render(<PhotoSharePanel build={build} hasPhoto />);
    fireEvent.click(await readyButton());
    await screen.findByText(/共有を開けませんでした/);
    expect(screen.getByRole("link", { name: "写真を保存" })).toBeVisible();
  });

  it.each([false, "throws"])("offers photo download when canShare returns %s", async (mode) => {
    canShare.mockImplementation(() => { if (mode === "throws") throw new Error("policy"); return false; });
    render(<PhotoSharePanel build={build} hasPhoto />);
    await screen.findByRole("link", { name: "写真を保存" });
    expect(screen.getByRole("button", { name: "写真を添付して共有" })).toBeDisabled();
    expect(screen.getByText(/このブラウザでは写真付き/)).toBeVisible();
    expect(share).not.toHaveBeenCalled();
  });

  it("removes the download link and disables sharing immediately after an edit", async () => {
    const { rerender, unmount } = render(<PhotoSharePanel build={build} hasPhoto />);
    await readyButton();
    await screen.findByRole("link", { name: "写真を保存" });
    rerender(<PhotoSharePanel build={() => new Promise(() => {})} hasPhoto />);
    expect(screen.queryByRole("link", { name: "写真を保存" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "写真を準備中…" })).toBeDisabled();
    expect(revoke).toHaveBeenCalledWith("blob:photo");
    unmount();
  });

  it("keeps the caption selectable if clipboard permission is denied", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<PhotoSharePanel build={build} hasPhoto />);
    fireEvent.click(screen.getByRole("button", { name: "投稿文をコピー" }));
    await screen.findByText(/下の投稿文を選択してコピー/);
    expect(screen.getByLabelText("一緒に添える投稿文")).toHaveValue("岩手旅の思い出。 #岩手旅 #VOJAIWATE");
  });
});
