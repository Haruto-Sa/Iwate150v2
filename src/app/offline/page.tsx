import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Offline",
  description: "オフライン状態です。接続を確認してから再度お試しください。",
  path: "/offline",
  noIndex: true,
});

/**
 * オフライン fallback ページ。
 *
 * @returns OfflinePage
 * @example
 * <OfflinePage />
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <PageHeading title="オフライン" />
      <div>
        <p className="text-sm leading-7 text-app-ink/75">
          インターネット接続を確認してから、もう一度ページを開いてください。
        </p>
      </div>
      <Link href="/" className="action-link">ホームを開く</Link>
    </div>
  );
}
