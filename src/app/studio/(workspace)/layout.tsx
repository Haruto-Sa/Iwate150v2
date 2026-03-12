import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
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
    notFound();
  }

  const currentUser = await fetchAppUserByIdentity(identityId);
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-emerald-900/10 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.92))] p-6 shadow-sm ring-1 ring-emerald-900/5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Studio workspace</p>
            <div>
              <h1 className="text-3xl font-semibold text-zinc-950">Operational console</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
                管理操作はすべてサーバー側で role を再検証したうえで実行します。公開面とは分離した運用ワークスペースとして扱います。
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-900 ring-1 ring-emerald-900/10">
              {currentUser.role}
            </span>
            <Link href="/" className="text-sm font-medium text-emerald-900 underline decoration-emerald-300 underline-offset-4">
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

