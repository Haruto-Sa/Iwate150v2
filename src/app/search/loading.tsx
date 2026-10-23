/**
 * Search ページのローディング UI。
 *
 * 検索入力フィールドとフィルタ、スポットカードリストのスケルトンを表示する。
 *
 * @returns SearchLoading コンポーネント
 */
export default function SearchLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* SectionTitle スケルトン */}
      <div className="space-y-2">
        <div className="h-7 w-24 rounded-lg bg-app-surface-tint" />
        <div className="h-4 w-56 rounded-md bg-app-surface-soft" />
      </div>

      {/* 検索フォーム スケルトン */}
      <div className="space-y-3">
        <div className="h-12 w-full rounded-2xl bg-app-surface/90 ring-1 ring-app-line/10" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-app-surface-tint" />
          <div className="h-8 w-24 rounded-full bg-app-surface-soft" />
          <div className="h-8 w-20 rounded-full bg-app-surface-soft" />
        </div>
      </div>

      {/* カードリスト スケルトン */}
      <div className="card-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-app-surface/90 p-4 shadow-xl ring-1 ring-app-line/8 space-y-3"
          >
            <div className="h-40 w-full rounded-xl bg-app-surface-soft" />
            <div className="space-y-1">
              <div className="h-3 w-14 rounded bg-app-surface-soft" />
              <div className="h-5 w-36 rounded bg-app-surface-tint" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-app-surface-soft" />
              <div className="h-3 w-2/3 rounded bg-app-surface-soft" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
