"use client";

import { setColorTheme, useColorTheme, type ColorTheme } from "@/lib/colorTheme";
import { useMenuLanguage } from "@/lib/menuLanguage";

/**
 * 外観を選択する。
 * @returns ライト・ダーク・端末設定の選択欄
 * @example <ColorThemeSelect />
 */
export function ColorThemeSelect() {
  const theme = useColorTheme();
  const { language } = useMenuLanguage();
  const labels = language === "en"
    ? { title: "Appearance", light: "Light", dark: "Dark", system: "System" }
    : { title: "外観", light: "ライト", dark: "ダーク", system: "端末設定" };
  return (
    <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{labels.title}</span>
      <select value={theme} onChange={event => setColorTheme(event.target.value as ColorTheme)}
        className="min-h-11 rounded-xl border border-app-line/20 bg-app-surface px-3 text-app-ink-strong">
        <option value="light">{labels.light}</option>
        <option value="dark">{labels.dark}</option>
        <option value="system">{labels.system}</option>
      </select>
    </label>
  );
}
