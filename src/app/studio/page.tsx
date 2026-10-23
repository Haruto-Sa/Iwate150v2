import { BarChart3, ShieldCheck, Sparkles, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudioNav } from "@/components/studio/StudioNav";
import { fetchAppUserByIdentity } from "@/lib/authServer";
import { buildPageMetadata } from "@/lib/seo";
import { fetchAdminDashboardStats, fetchManageableUsers } from "@/lib/supabaseClient";

export const metadata = buildPageMetadata({
  title: "Studio",
  description: "運用担当者向けの非公開ワークスペースです。",
  path: "/studio",
  noIndex: true,
});

/**
 * secret workspace のダッシュボード。
 *
 * @returns Studio dashboard
 * @example
 * <StudioPage />
 */
export default async function StudioPage() {
  const session = await auth();
  const identityId = session?.user?.id;
  if (!identityId) {
    notFound();
  }

  const currentUser = await fetchAppUserByIdentity(identityId);
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
    redirect("/studio/access?denied=1");
  }

  const [stats, users] = await Promise.all([fetchAdminDashboardStats(), fetchManageableUsers(12)]);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-app-line/10 bg-app-surface-soft p-6 shadow-sm ring-1 ring-app-line/5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-accent-ink">Studio workspace</p>
            <div>
              <h1 className="text-3xl font-semibold text-app-ink-strong">Operational console</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-app-ink-muted">
                管理操作はすべてサーバー側で role を再検証したうえで実行します。公開面とは分離した運用ワークスペースです。
              </p>
            </div>
          </div>
          <span className="inline-flex rounded-full bg-app-surface px-3 py-1 text-sm font-medium text-app-ink ring-1 ring-app-line/10">
            {currentUser.role}
          </span>
        </div>
        <div className="mt-6">
          <StudioNav />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Users", value: stats.totalUsers, icon: Users },
          { label: "Admins", value: stats.totalAdmins, icon: ShieldCheck },
          { label: "Spots", value: stats.totalSpots, icon: Sparkles },
          { label: "Events", value: stats.totalEvents, icon: BarChart3 },
        ].map((item) => (
          <div key={item.label} className="rounded-[28px] border border-app-line-soft bg-app-surface p-5 shadow-sm">
            <item.icon className="h-5 w-5 text-app-accent-ink" />
            <p className="mt-4 text-3xl font-semibold text-app-ink-strong">{item.value}</p>
            <p className="mt-1 text-sm text-app-ink-muted">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-app-line-soft bg-app-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-app-ink-strong">Current role</h2>
          <p className="mt-3 text-sm leading-6 text-app-ink-muted">
            {currentUser.email ?? currentUser.display_name}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-app-surface-soft px-3 py-1 text-sm font-medium text-app-ink">
            {currentUser.role}
          </p>
          <p className="mt-4 text-sm leading-6 text-app-ink-muted">
            運用 API は `/studio` 配下へ集約し、一覧 read を含めて service role クライアントで扱います。
          </p>
        </div>

        <div className="rounded-[28px] border border-app-line-soft bg-app-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-app-ink-strong">Recent members</h2>
          <div className="mt-4 space-y-3">
            {users.length > 0 ? (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-app-line-soft bg-app-surface-soft px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-app-ink-strong">
                      {user.display_name || user.email || `User #${user.id}`}
                    </p>
                    <p className="text-xs text-app-ink-muted">{user.email ?? "Email unavailable"}</p>
                  </div>
                  <span className="rounded-full bg-app-surface px-3 py-1 text-xs font-medium text-app-ink-muted">
                    {user.role}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-app-ink-muted">ユーザー情報をまだ取得できていません。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
