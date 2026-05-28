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
        <div className="h-7 w-24 rounded-lg bg-emerald-100" />
        <div className="h-4 w-56 rounded-md bg-emerald-50" />
      </div>

      {/* 検索フォーム スケルトン */}
      <div className="space-y-3">
        <div className="h-12 w-full rounded-2xl bg-white/90 ring-1 ring-emerald-900/10" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-emerald-100" />
          <div className="h-8 w-24 rounded-full bg-emerald-50" />
          <div className="h-8 w-20 rounded-full bg-emerald-50" />
        </div>
      </div>

      {/* カードリスト スケルトン */}
      <div className="card-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/90 p-4 shadow-xl ring-1 ring-emerald-900/8 space-y-3"
          >
            <div className="h-40 w-full rounded-xl bg-emerald-50" />
            <div className="space-y-1">
              <div className="h-3 w-14 rounded bg-emerald-50" />
              <div className="h-5 w-36 rounded bg-emerald-100" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-emerald-50" />
              <div className="h-3 w-2/3 rounded bg-emerald-50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
