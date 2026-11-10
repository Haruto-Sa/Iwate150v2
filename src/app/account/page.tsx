import Link from "next/link";
import { DeleteOwnData } from "@/components/auth/DeleteOwnData";
import { PageHeading } from "@/components/ui/PageHeading";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({ title: "保存データ", description: "保存データの管理", path: "/account", noIndex: true });

/**
 * 本人の保存データの削除画面。
 * @returns 管理画面
 * @example <AccountPage />
 */
export default function AccountPage() {
  return <div className="space-y-6">
    <PageHeading title="保存データ" actions={<Link href="/favorites" className="action-link action-link-secondary">お気に入りに戻る</Link>} />
    <DeleteOwnData />
  </div>;
}
