/**
 * 本文の描画前に実行する外観初期化。ユーザー入力はコードへ埋め込まない。
 * 保存できない環境でも現在のタブの選択は維持する。
 * @example <script dangerouslySetInnerHTML={{ __html: COLOR_THEME_SCRIPT }} />
 */
export const COLOR_THEME_SCRIPT = `(() => {
  const key = "voja_color_theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  /** @param value 保存値 @returns 正規化した設定 @example valid("dark") */
  const valid = value => value === "light" || value === "dark" ? value : "system";
  /** @returns 保存値または端末設定 @example read() */
  const read = () => { try { return valid(localStorage.getItem(key)); } catch { return "system"; } };
  let preference = read();
  /** @returns なし @example apply() */
  const apply = () => {
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === "system" ? (media.matches ? "dark" : "light") : preference;
    window.dispatchEvent(new Event("voja-theme-change"));
  };
  window.addEventListener("voja-theme-set", event => {
    preference = valid(event.detail);
    try { localStorage.setItem(key, preference); } catch {}
    apply();
  });
  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) { preference = read(); apply(); }
  });
  window.addEventListener("voja-theme-refresh", apply);
  media.addEventListener("change", apply);
  apply();
})();`;
