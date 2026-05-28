/**
 * グローバルローディング UI（App Router Suspense boundary）。
 *
 * ページ遷移中または初回ロード時に自動表示される。
 * スケルトン UI でコンテンツ領域の高さを確保し CLS を防ぐ。
 *
 * @returns LoadingPage コンポーネント
 */
export default function LoadingPage() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* SectionTitle スケルトン */}
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-emerald-100" />
        <div className="h-4 w-64 rounded-md bg-emerald-50" />
      </div>

      {/* カードグリッド スケルトン */}
      <div className="card-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/90 p-4 shadow-xl ring-1 ring-emerald-900/8 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-100" />
              <div className="space-y-1">
                <div className="h-3 w-16 rounded bg-emerald-50" />
                <div className="h-5 w-32 rounded bg-emerald-100" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-emerald-50" />
              <div className="h-3 w-4/5 rounded bg-emerald-50" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-emerald-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
