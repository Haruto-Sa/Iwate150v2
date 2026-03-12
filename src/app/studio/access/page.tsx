import Link from "next/link";
import { ShieldCheck, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Studio Access",
  description: "運用担当者向けの非公開ワークスペース入口です。",
  path: "/studio/access",
  noIndex: true,
});

/**
 * secret workspace の入口ページ。
 *
 * @returns StudioAccessPage
 * @example
 * <StudioAccessPage />
 */
export default function StudioAccessPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
        <ShieldCheck className="h-4 w-4" />
        Private workspace
      </p>
      <h1 className="mt-4 text-3xl font-semibold text-zinc-950">Operational access</h1>
      <p className="mt-3 text-sm leading-7 text-zinc-600">
        この入口は一般公開向けではありません。権限のある運用アカウントでログインした後にワークスペースへ進んでください。
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/login?next=/studio">
          <Button className="justify-between">
            <span>Login and continue</span>
            <MoveRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/" className="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50">
          Back to public site
        </Link>
      </div>
    </div>
  );
}
