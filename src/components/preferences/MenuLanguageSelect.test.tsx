import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuLanguageSelect } from "./MenuLanguageSelect";
import { MENU_LANGUAGE_KEY, setMenuLanguage, useMenuLanguage } from "@/lib/menuLanguage";

/** 表示更新の確認用。@returns 翻訳済みラベル @example <MenuLabel /> */
function MenuLabel() {
  const { messages } = useMenuLanguage();
  return <p>{messages.more}</p>;
}

beforeEach(() => { localStorage.clear(); setMenuLanguage("ja"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); setMenuLanguage("ja"); });

describe("メニュー言語", () => {
  it("切替を保存し、複数の表示と再マウント後にも反映する", async () => {
    const view = render(<><MenuLanguageSelect /><MenuLabel /></>);
    await userEvent.selectOptions(screen.getByRole("combobox"), "en");
    expect(screen.getByText("More")).toBeVisible();
    expect(localStorage.getItem(MENU_LANGUAGE_KEY)).toBe("en");
    view.unmount();
    render(<MenuLabel />);
    expect(screen.getByText("More")).toBeVisible();
  });

  it("他タブの更新と不正値の日本語フォールバックを反映する", () => {
    render(<MenuLabel />);
    act(() => { localStorage.setItem(MENU_LANGUAGE_KEY, "en"); window.dispatchEvent(new StorageEvent("storage", { key: MENU_LANGUAGE_KEY })); });
    expect(screen.getByText("More")).toBeVisible();
    act(() => { localStorage.setItem(MENU_LANGUAGE_KEY, "invalid"); window.dispatchEvent(new StorageEvent("storage", { key: MENU_LANGUAGE_KEY })); });
    expect(screen.getByText("その他")).toBeVisible();
  });

  it("保存だけが拒否されても現在の画面で切り替えられる", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    render(<><MenuLanguageSelect /><MenuLabel /></>);
    await userEvent.selectOptions(screen.getByRole("combobox"), "en");
    expect(screen.getByText("More")).toBeVisible();
    expect(localStorage.getItem(MENU_LANGUAGE_KEY)).toBe("ja");
  });
});
