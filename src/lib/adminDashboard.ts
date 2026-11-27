import "server-only";
import { getServerAdminClient } from "@/lib/authServer";
import type { AdminDashboardStats, AdminDashboardSpotSummary, AdminDashboardEventSummary, AdminUserSummary } from "@/lib/types";

/**
 * 管理ダッシュボード表示用の集計値を取得する。
 *
 * @returns 管理ダッシュボード統計。Supabase未接続/取得失敗時は件数不明
 * @example
 * const stats = await fetchAdminDashboardStats();
 */
export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const fallback: AdminDashboardStats = {
    totalUsers: null,
    totalSpots: null,
    totalEvents: null,
    totalAdmins: null,
    latestSpots: [],
    latestEvents: [],
  };

  const client = getServerAdminClient();
  if (!client) return fallback;

  const [
    totalUsersRes,
    totalSpotsRes,
    totalEventsRes,
    totalAdminsRes,
    latestSpotsRes,
    latestEventsRes,
  ] = await Promise.all([
    client.from("users").select("*", { head: true, count: "exact" }),
    client.from("spots").select("*", { head: true, count: "exact" }),
    client.from("events").select("*", { head: true, count: "exact" }),
    client
      .from("users")
      .select("*", { head: true, count: "exact" })
      .in("role", ["admin", "super_admin"]),
    client.from("spots").select("id,name,city_id").order("id", { ascending: false }).limit(5),
    client
      .from("events")
      .select("id,title,city_id,start_date")
      .order("id", { ascending: false })
      .limit(5),
  ]);

  const hasError = [
    totalUsersRes.error,
    totalSpotsRes.error,
    totalEventsRes.error,
    totalAdminsRes.error,
    latestSpotsRes.error,
    latestEventsRes.error,
  ].some(Boolean);

  if (hasError) {
    console.warn("[supabase] admin dashboard stats fetch error", {
      totalUsersError: totalUsersRes.error?.message,
      totalSpotsError: totalSpotsRes.error?.message,
      totalEventsError: totalEventsRes.error?.message,
      totalAdminsError: totalAdminsRes.error?.message,
      latestSpotsError: latestSpotsRes.error?.message,
      latestEventsError: latestEventsRes.error?.message,
    });
  }

  return {
    totalUsers: totalUsersRes.error ? null : totalUsersRes.count,
    totalSpots: totalSpotsRes.error ? null : totalSpotsRes.count,
    totalEvents: totalEventsRes.error ? null : totalEventsRes.count,
    totalAdmins: totalAdminsRes.error ? null : totalAdminsRes.count,
    latestSpots: (latestSpotsRes.data ?? []) as AdminDashboardSpotSummary[],
    latestEvents: (latestEventsRes.data ?? []) as AdminDashboardEventSummary[],
  };
}

/**
 * 管理対象ユーザー一覧を取得する。
 *
 * @param limit - 最大件数
 * @returns 管理対象ユーザー配列
 * @example
 * const users = await fetchManageableUsers(200);
 */
export async function fetchManageableUsers(limit = 200): Promise<AdminUserSummary[]> {
  const client = getServerAdminClient();
  if (!client) return [];
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
  const { data, error } = await client
    .from("users")
    .select("id,auth_id,email,display_name,role")
    .order("id", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.warn("[supabase] manageable users fetch error:", error);
    return [];
  }
  return (data ?? []) as AdminUserSummary[];
}
