import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { COLOR_THEME_SCRIPT } from "./colorThemeScript";

/**
 * 初期描画スクリプトをDOMと保存先の境界で実行する。
 * @param stored - 初期保存値
 * @param dark - 端末設定
 * @param blocked - 保存が失敗する環境
 * @returns 外観状態とイベント送信関数
 * @example boot("dark", false);
 */
function boot(stored: string | null, dark: boolean, blocked = false) {
  const listeners = new Map<string, (event: { detail?: string; key?: string | null }) => void>();
  const dataset: Record<string, string> = {};
  const document = { documentElement: { dataset } };
  let change: () => void = () => {};
  const media = { matches: dark, addEventListener: (_: string, listener: () => void) => { change = listener; } };
  const storage = { value: stored };
  runInNewContext(COLOR_THEME_SCRIPT, {
    document,
    localStorage: {
      getItem: () => { if (blocked) throw new Error("blocked"); return storage.value; },
      setItem: (_: string, value: string) => { if (blocked) throw new Error("blocked"); storage.value = value; },
    },
    window: { matchMedia: () => media, addEventListener: (type: string, listener: () => void) => listeners.set(type, listener), dispatchEvent: () => {} },
    Event: class { constructor(public type: string) {} },
  }, { timeout: 1000 });
  return { dataset, document, media, storage, change: () => change(), emit: (type: string, event: { detail?: string; key?: string | null }) => listeners.get(type)?.(event) };
}

describe("color theme before hydration", () => {
  it("saved light overrides a dark device", () => {
    expect(boot("light", true).dataset).toEqual({ theme: "light", themePreference: "light" });
  });
  it("unknown preferences follow device changes", () => {
    const state = boot("invalid", true);
    expect(state.dataset.theme).toBe("dark");
    state.media.matches = false; state.change();
    expect(state.dataset.theme).toBe("light");
  });
  it("keeps an explicit choice when saving fails", () => {
    const state = boot(null, false, true);
    state.emit("voja-theme-set", { detail: "dark" });
    state.media.matches = false; state.change();
    expect(state.dataset.theme).toBe("dark");
    expect(state.storage.value).toBeNull();
  });
  it("reapplies the choice when the document root is regenerated", () => {
    const state = boot("dark", false);
    state.document.documentElement = { dataset: {} };
    state.emit("voja-theme-refresh", {});
    expect(state.document.documentElement.dataset.theme).toBe("dark");
  });
  it("reads changes and cleared preferences from another tab", () => {
    const state = boot("light", true);
    state.storage.value = "dark"; state.emit("storage", { key: "voja_color_theme" });
    expect(state.dataset.theme).toBe("dark");
    state.storage.value = null; state.emit("storage", { key: null });
    expect(state.dataset.themePreference).toBe("system");
  });
});
