"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * グローバルエラーバウンダリ。
 *
 * ランタイムエラーが発生した場合に表示されるフォールバック UI。
 * ホームへの導線と再試行ボタンを提供する。
 *
 * @param props.error - キャッチされたエラー
 * @param props.reset - エラーバウンダリをリセットして再レンダリングを試みる関数
 * @returns ErrorPage コンポーネント
 * @example
 * // Next.js App Router により自動的にマウントされる
 */
export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    // 本番ではエラー監視サービス（Sentry 等）に送信できる
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* アイコン */}
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-app-warning-surface ring-1 ring-app-warning/30">
          <AlertTriangle className="h-10 w-10 text-app-warning" strokeWidth={1.5} />
        </div>

        {/* タイトル */}
        <h1 className="text-balance font-display mb-2 text-2xl leading-relaxed text-app-ink-strong">エラーが発生しました</h1>
        <p className="mb-6 text-sm leading-7 text-app-ink-muted">
          申し訳ありません。予期しないエラーが発生しました。
          <br />
          再試行するか、ホームに戻ってください。
        </p>

        {/* エラー詳細（開発時のみ） */}
        {process.env.NODE_ENV === "development" && (
          <details className="mb-6 rounded-xl border border-app-danger/30 bg-app-danger-surface px-4 py-3 text-left">
            <summary className="cursor-pointer text-xs font-medium text-app-danger">
              エラー詳細（開発環境のみ）
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-app-danger">{error.message}</pre>
            {error.digest && (
              <p className="mt-1 text-xs text-app-danger">Digest: {error.digest}</p>
            )}
          </details>
        )}

        {/* アクション */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            もう一度試す
          </Button>
          <Link
            href="/"
            className="interactive-lift inline-flex items-center gap-2 rounded-xl border border-app-line/20 px-4 py-2 text-sm text-app-ink transition duration-200 hover:bg-app-surface-soft"
          >
            <Home className="h-4 w-4" />
            ホームへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
