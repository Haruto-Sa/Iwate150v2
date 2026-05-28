/**
 * Map ページのローディング UI。
 *
 * 地図コンテナと近傍スポットリストのスケルトンを表示し、
 * Leaflet の読み込み中の CLS（累積レイアウトシフト）を防ぐ。
 *
 * @returns MapLoading コンポーネント
 */
export default function MapLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* SectionTitle スケルトン */}
      <div className="space-y-2">
        <div className="h-7 w-24 rounded-lg bg-emerald-100" />
        <div className="h-4 w-72 rounded-md bg-emerald-50" />
      </div>

      {/* コントロールパネル スケルトン */}
      <div className="glass rounded-3xl border border-white/10 p-4 ring-1 ring-white/15 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="h-6 w-40 rounded bg-emerald-50" />
          <div className="h-6 w-44 rounded bg-emerald-50" />
          <div className="h-8 w-28 rounded-lg bg-emerald-100" />
        </div>
        {/* 地図エリア スケルトン（高さを固定して CLS を防ぐ） */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-900/10 bg-emerald-50 h-[400px] flex items-center justify-center">
          <span className="text-sm text-emerald-400">地図を読み込み中...</span>
        </div>
      </div>

      {/* スポットリスト スケルトン */}
      <div className="space-y-2">
        <div className="h-7 w-36 rounded-lg bg-emerald-100" />
      </div>
      <div className="card-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/90 p-4 shadow-xl ring-1 ring-emerald-900/8 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-100" />
              <div className="space-y-1">
                <div className="h-3 w-12 rounded bg-emerald-50" />
                <div className="h-5 w-28 rounded bg-emerald-100" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-emerald-50" />
              <div className="h-3 w-3/4 rounded bg-emerald-50" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded-lg bg-emerald-50" />
              <div className="h-8 w-24 rounded-lg bg-emerald-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
