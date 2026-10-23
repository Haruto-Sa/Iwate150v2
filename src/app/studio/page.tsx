import { BarChart3, ShieldCheck, Sparkles, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudioNav } from "@/components/studio/StudioNav";
import { fetchAppUserByIdentity } from "@/lib/authServer";
import { buildPageMetadata } from "@/lib/seo";
import { fetchAdminDashboardStats, fetchManageableUsers } from "@/lib/adminDashboard";

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
      <section className="rounded-[32px] border border-emerald-900/10 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.92))] p-6 shadow-sm ring-1 ring-emerald-900/5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-950">管理</h1>
            </div>
          </div>
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-900 ring-1 ring-emerald-900/10">
            {currentUser.role}
          </span>
        </div>
        <div className="mt-6">
          <StudioNav />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "利用者", value: stats.totalUsers, icon: Users },
          { label: "管理者", value: stats.totalAdmins, icon: ShieldCheck },
          { label: "スポット", value: stats.totalSpots, icon: Sparkles },
          { label: "イベント", value: stats.totalEvents, icon: BarChart3 },
        ].map((item) => (
          <div key={item.label} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
            <item.icon className="h-5 w-5 text-emerald-700" />
            <p className={`mt-4 font-semibold text-zinc-950 ${item.value === null ? "text-sm" : "text-3xl"}`}>{item.value ?? "取得できません"}</p>
            <p className="mt-1 text-sm text-zinc-600">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">現在の権限</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {currentUser.email ?? currentUser.display_name}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
            {currentUser.role}
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">利用者</h2>
          <div className="mt-4 space-y-3">
            {users.length > 0 ? (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-950">
                      {user.display_name || user.email || `User #${user.id}`}
                    </p>
                    {user.email && <p className="text-xs text-zinc-500">{user.email}</p>}
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                    {user.role}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">ユーザー情報をまだ取得できていません。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
