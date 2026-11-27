import Link from "next/link";
import { MapPin, Search, Home } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "ページが見つかりません",
  description: "お探しのページは存在しないか、移動した可能性があります。",
  path: "/404",
  noIndex: true,
});

/**
 * 404 Not Found ページ。
 *
 * 存在しないパスへのアクセス時に表示される。
 * ホーム・地図・検索への導線を提供する。
 *
 * @returns NotFoundPage コンポーネント
 * @example
 * // Next.js App Router により自動的にマウントされる
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* 大きな数字 */}
        <p className="font-display mb-2 text-8xl font-bold text-emerald-200 select-none">404</p>

        {/* タイトル */}
        <h1 className="text-balance font-display mb-2 text-2xl leading-relaxed text-app-ink-strong">ページが見つかりません</h1>
        <p className="mb-8 text-sm leading-7 text-app-ink-muted">
          お探しのページは存在しないか、移動した可能性があります。
          <br />
          以下から目的のページへお進みください。
        </p>

        {/* ショートカットリンク */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="interactive-lift inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white shadow-md transition duration-200 hover:bg-emerald-800"
          >
            <Home className="h-4 w-4" />
            ホームへ戻る
          </Link>
          <Link
            href="/map"
            className="interactive-lift inline-flex items-center justify-center gap-2 rounded-2xl border border-app-line/20 bg-app-surface/80 px-5 py-3 text-sm font-medium text-app-ink transition duration-200 hover:bg-app-surface"
          >
            <MapPin className="h-4 w-4" />
            地図で探す
          </Link>
          <Link
            href="/search"
            className="interactive-lift inline-flex items-center justify-center gap-2 rounded-2xl border border-app-line/20 bg-app-surface/80 px-5 py-3 text-sm font-medium text-app-ink transition duration-200 hover:bg-app-surface"
          >
            <Search className="h-4 w-4" />
            スポットを検索
          </Link>
        </div>
      </div>
    </div>
  );
}
