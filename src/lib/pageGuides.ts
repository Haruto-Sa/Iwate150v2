export const pageGuides = {
  "/": { ja: { title: "旅のメニュー", action: "旅先を探す", hint: "カレンダーの日付からイベントを選べます。" }, en: { title: "Your trip", action: "Find places", hint: "Choose a date on the calendar to find events." } },
  "/camera": { ja: { title: "カメラの使い方", action: "撮影を始める", hint: "カメラを許可し、キャラクターを選んで撮影します。" }, en: { title: "Using the camera", action: "Start taking photos", hint: "Allow camera access, choose a character, then take a photo." } },
  "/search": { ja: { title: "検索の使い方", action: "検索を始める", hint: "スポットとイベントを切り替え、キーワードや地域で絞り込みます。" }, en: { title: "Using search", action: "Start searching", hint: "Choose spots or events, then filter by keyword or area." } },
  "/map": { ja: { title: "地図の使い方", action: "地図を見る", hint: "地図の印を選ぶと、スポットの詳細を開けます。" }, en: { title: "Using the map", action: "View the map", hint: "Select a map marker to open a place’s details." } },
  "/stamps": { ja: { title: "スタンプの集め方", action: "スタンプを見る", hint: "ログイン後、位置情報を許可し、対象スポットの近くで収集します。" }, en: { title: "Collecting stamps", action: "View stamps", hint: "Sign in, allow location access, then collect stamps near eligible places." } },
  "/character": { ja: { title: "キャラクターの操作", action: "キャラクターを見る", hint: "ドラッグで向きを変え、ピンチやスクロールで拡大・縮小できます。" }, en: { title: "Character controls", action: "View characters", hint: "Drag to rotate. Pinch or scroll to zoom." } },
  "/favorites": { ja: { title: "お気に入りの使い方", action: "お気に入りを見る", hint: "ログイン後、スポットのハートで保存・解除します。" }, en: { title: "Using favorites", action: "View favorites", hint: "Sign in, then use a place’s heart button to save or remove it." } },
} as const;
export type GuidePath = keyof typeof pageGuides;

/** 対象7画面の案内キーを返す。@param pathname - 現在パス @returns 対象外はnull @example getGuidePath("/search"); */
export function getGuidePath(pathname: string): GuidePath | null {
  return Object.hasOwn(pageGuides, pathname) ? pathname as GuidePath : null;
}
