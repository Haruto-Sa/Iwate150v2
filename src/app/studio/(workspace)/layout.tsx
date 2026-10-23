import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudioNav } from "@/components/studio/StudioNav";
import { fetchAppUserByIdentity } from "@/lib/authServer";

type Props = {
  children: ReactNode;
};

/**
 * Studio ワークスペース専用レイアウト。
 *
 * @param props - レイアウト props
 * @returns 認証済み Studio layout
 * @example
 * <StudioWorkspaceLayout><div /></StudioWorkspaceLayout>
 */
export default async function StudioWorkspaceLayout({ children }: Props) {
  const session = await auth();
  const identityId = session?.user?.id;
  if (!identityId) {
    redirect("/login?next=/studio");
  }

  const currentUser = await fetchAppUserByIdentity(identityId);
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
    redirect("/studio/access?denied=1");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-app-line/10 bg-app-surface-soft p-6 shadow-sm ring-1 ring-app-line/5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-accent-ink">Studio workspace</p>
            <div>
              <h1 className="text-3xl font-semibold text-app-ink-strong">Operational console</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-app-ink-muted">
                管理操作はすべてサーバー側で role を再検証したうえで実行します。公開面とは分離した運用ワークスペースとして扱います。
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <span className="inline-flex rounded-full bg-app-surface px-3 py-1 text-sm font-medium text-app-ink ring-1 ring-app-line/10">
              {currentUser.role}
            </span>
            <Link href="/" className="text-sm font-medium text-app-ink underline decoration-emerald-300 underline-offset-4">
              Public site
            </Link>
          </div>
        </div>
        <div className="mt-6">
          <StudioNav />
        </div>
      </section>

      {children}
    </div>
  );
}
