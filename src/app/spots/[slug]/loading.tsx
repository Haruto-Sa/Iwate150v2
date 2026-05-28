/**
 * スポット詳細ページのローディング UI。
 *
 * ヒーロー画像・タイトル・説明文・地図のスケルトンを表示し、CLS を防ぐ。
 *
 * @returns SpotDetailLoading コンポーネント
 */
export default function SpotDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* ヒーロー画像 スケルトン */}
      <div className="h-64 w-full rounded-3xl bg-emerald-100 sm:h-80" />

      {/* タイトル・バッジ スケルトン */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-full bg-emerald-100" />
          <div className="h-6 w-20 rounded-full bg-emerald-50" />
        </div>
        <div className="h-9 w-3/4 rounded-lg bg-emerald-100" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-emerald-50" />
          <div className="h-4 w-5/6 rounded bg-emerald-50" />
          <div className="h-4 w-4/5 rounded bg-emerald-50" />
        </div>
      </div>

      {/* アクションボタン スケルトン */}
      <div className="flex gap-3">
        <div className="h-10 w-32 rounded-xl bg-emerald-100" />
        <div className="h-10 w-28 rounded-xl bg-emerald-50" />
        <div className="h-10 w-28 rounded-xl bg-emerald-50" />
      </div>

      {/* 地図エリア スケルトン */}
      <div className="h-56 w-full rounded-2xl bg-emerald-50" />
    </div>
  );
}
