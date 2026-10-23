"use client";

import { setMenuLanguage, useMenuLanguage } from "@/lib/menuLanguage";

/**
 * メニューのみを翻訳することが分かる言語選択。
 * @returns 日本語・英語の選択欄
 * @example <MenuLanguageSelect />
 */
export function MenuLanguageSelect() {
  const { language } = useMenuLanguage();
  return (
    <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span><span lang="ja">メニューの言語</span>{" "}<span lang="en" className="ml-2">Menu language</span></span>
      <select value={language} onChange={(event) => setMenuLanguage(event.target.value === "en" ? "en" : "ja")}
        className="min-h-11 rounded-xl border border-emerald-900/20 bg-white px-3 text-emerald-950">
        <option lang="ja" value="ja">日本語</option>
        <option lang="en" value="en">English</option>
      </select>
    </label>
  );
}
