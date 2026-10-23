"use client";

import { useSyncExternalStore } from "react";

export type MenuLanguage = "ja" | "en";
export const MENU_LANGUAGE_KEY = "voja_menu_language";
const CHANGE_EVENT = "voja-menu-language-change";
let temporaryLanguage: MenuLanguage | undefined;

export const menuMessages = {
  ja: {
    home: "ホーム", camera: "カメラ", search: "検索", map: "地図", stamps: "スタンプ",
    characters: "キャラクター", favorites: "お気に入り", more: "その他", closeMore: "その他を閉じる",
    mainPages: "主要ページ", mobilePages: "モバイル主要ページ", morePages: "その他のページ",
    skipContent: "本文へ移動", login: "ログイン", logout: "ログアウト", account: "マイページ",
    tripMenu: "旅のメニュー", startTrip: "旅を始める", findPlaces: "旅先を探す", takePhoto: "写真を撮る",
    viewStamps: "スタンプを見る", close: "閉じる", install: "ホーム画面に追加", add: "追加する", later: "あとで",
    safariInstall: "Safari の共有メニューから「ホーム画面に追加」を選んでください。",
    closeInstall: "ホーム画面に追加 を閉じる",
    installFailed: "このブラウザではインストール画面を開けませんでした。",
  },
  en: {
    home: "Home", camera: "Camera", search: "Search", map: "Map", stamps: "Stamps",
    characters: "Characters", favorites: "Favorites", more: "More", closeMore: "Close more menu",
    mainPages: "Main pages", mobilePages: "Mobile main pages", morePages: "More pages",
    skipContent: "Skip to content", login: "Sign in", logout: "Sign out", account: "My page",
    tripMenu: "Your trip", startTrip: "Start your trip", findPlaces: "Find places", takePhoto: "Take a photo",
    viewStamps: "View stamps", close: "Close", install: "Add to Home Screen", add: "Add", later: "Later",
    safariInstall: "In Safari’s Share menu, choose Add to Home Screen.",
    closeInstall: "Close Add to Home Screen",
    installFailed: "The installation screen could not be opened in this browser.",
  },
} as const;

/**
 * 保存されたメニュー言語を読む。未設定・不正値は日本語とする。
 * @returns 日本語または英語
 * @example readMenuLanguage();
 */
function readMenuLanguage(): MenuLanguage {
  if (temporaryLanguage) return temporaryLanguage;
  try { return localStorage.getItem(MENU_LANGUAGE_KEY) === "en" ? "en" : "ja"; }
  catch { return "ja"; }
}

/**
 * 同じページと他タブの設定変更を購読する。
 * @param listener - 言語の再取得処理
 * @returns 購読解除処理
 * @example subscribeMenuLanguage(refresh);
 */
function subscribeMenuLanguage(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * SSRと最初のhydrationは既存の日本語表示を維持する。
 * @returns 日本語
 * @example serverLanguage();
 */
function serverLanguage(): MenuLanguage { return "ja"; }

/**
 * メニュー言語を保存し、表示中のナビゲーションと案内へ反映する。
 * @param language - 選択した言語
 * @returns なし
 * @example setMenuLanguage("en");
 */
export function setMenuLanguage(language: MenuLanguage): void {
  try {
    localStorage.setItem(MENU_LANGUAGE_KEY, language);
    temporaryLanguage = undefined;
  } catch { temporaryLanguage = language; }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * 観光本文とは独立したメニュー・操作案内の辞書を返す。
 * @returns 言語と対応する文言
 * @example const { language, messages } = useMenuLanguage();
 */
export function useMenuLanguage() {
  const language = useSyncExternalStore(subscribeMenuLanguage, readMenuLanguage, serverLanguage);
  return { language, messages: menuMessages[language] };
}
