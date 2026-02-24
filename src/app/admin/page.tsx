"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/auth/SessionProvider";
import { Button } from "@/components/ui/Button";
import {
  createAdminEvent,
  createAdminSpot,
  fetchAdminDashboardStats,
  fetchCities,
  fetchCurrentAppUser,
  fetchGenres,
  fetchManageableUsers,
  uploadAdminAsset,
  updateUserRole,
} from "@/lib/supabaseClient";
import type { AdminDashboardStats, AdminUserSummary, City, Genre, User, UserRole } from "@/lib/types";

type Notice = {
  type: "success" | "error";
  text: string;
};

type SpotFormState = {
  name: string;
  description: string;
  cityId: string;
  genreId: string;
  lat: string;
  lng: string;
  referenceUrl: string;
  imagePath: string;
  modelPath: string;
};

type EventFormState = {
  title: string;
  location: string;
  cityId: string;
  startDate: string;
  endDate: string;
};

const EMPTY_STATS: AdminDashboardStats = {
  totalUsers: 0,
  newUsersLast7Days: 0,
  totalSpots: 0,
  totalEvents: 0,
  totalAdmins: 0,
  latestSpots: [],
  latestEvents: [],
};

/**
 * 数値文字列を number に変換する。
 *
 * @param value - 入力文字列
 * @param label - バリデーション対象名
 * @returns 変換後の数値
 * @throws Error 数値変換できない場合
 * @example
 * const lat = parseRequiredNumber("39.7", "緯度");
 */
function parseRequiredNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label}は数値で入力してください。`);
  }
  return parsed;
}

/**
 * 管理者ダッシュボード画面。
 *
 * `admin/super_admin` のみアクセス可能で、スポット/イベント追加と
 * 利用者管理（ロール変更）を提供する。
 *
 * @returns AdminDashboardPage コンポーネント
 * @example
 * <AdminDashboardPage />
 */
export default function AdminDashboardPage() {
  const router = useRouter();
  const { status, signOut } = useAuthSession();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [stats, setStats] = useState<AdminDashboardStats>(EMPTY_STATS);
  const [cities, setCities] = useState<City[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [spotForm, setSpotForm] = useState<SpotFormState>({
    name: "",
    description: "",
    cityId: "",
    genreId: "",
    lat: "",
    lng: "",
    referenceUrl: "",
    imagePath: "",
    modelPath: "",
  });
  const [eventForm, setEventForm] = useState<EventFormState>({
    title: "",
    location: "",
    cityId: "",
    startDate: "",
    endDate: "",
  });

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin" || isSuperAdmin;

  /**
   * 管理ダッシュボードの初期データを読み込む。
   *
   * @returns Promise<void>
   * @example
   * await loadDashboard();
   */
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [appUser, dashboardStats, cityList, genreList] = await Promise.all([
        fetchCurrentAppUser(),
        fetchAdminDashboardStats(),
        fetchCities(),
        fetchGenres(),
      ]);

      setCurrentUser(appUser);
      setStats(dashboardStats);
      setCities(cityList);
      setGenres(genreList);

      if (appUser?.role === "admin" || appUser?.role === "super_admin") {
        const manageableUsers = await fetchManageableUsers();
        setUsers(manageableUsers);
      } else {
        setUsers([]);
      }

      setSpotForm((prev) => ({
        ...prev,
        cityId: prev.cityId || String(cityList[0]?.id ?? ""),
        genreId: prev.genreId || String(genreList[0]?.id ?? ""),
      }));
      setEventForm((prev) => ({
        ...prev,
        cityId: prev.cityId || String(cityList[0]?.id ?? ""),
      }));
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "ダッシュボードの読み込みに失敗しました。",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/admin/login");
      return;
    }
    loadDashboard();
  }, [loadDashboard, router, status]);

  /**
   * スポット新規登録を送信する。
   *
   * @param event - フォームイベント
   * @returns Promise<void>
   * @example
   * <form onSubmit={handleSpotSubmit}>...</form>
   */
  const handleSpotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setNotice(null);
    try {
      const cityId = Number(spotForm.cityId);
      const genreId = Number(spotForm.genreId);
      if (!Number.isFinite(cityId) || !Number.isFinite(genreId)) {
        throw new Error("市町村・ジャンルを選択してください。");
      }

      await createAdminSpot({
        name: spotForm.name.trim(),
        description: spotForm.description.trim(),
        city_id: cityId,
        genre_id: genreId,
        lat: parseRequiredNumber(spotForm.lat, "緯度"),
        lng: parseRequiredNumber(spotForm.lng, "経度"),
        image_path: spotForm.imagePath.trim() || null,
        image_thumb_path: spotForm.imagePath.trim() || null,
        model_path: spotForm.modelPath.trim() || null,
        reference_url: spotForm.referenceUrl.trim() || null,
      });

      setNotice({ type: "success", text: "スポットを追加しました。" });
      setSpotForm((prev) => ({
        ...prev,
        name: "",
        description: "",
        lat: "",
        lng: "",
        referenceUrl: "",
      }));
      setStats(await fetchAdminDashboardStats());
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "スポット追加に失敗しました。",
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * イベント新規登録を送信する。
   *
   * @param event - フォームイベント
   * @returns Promise<void>
   * @example
   * <form onSubmit={handleEventSubmit}>...</form>
   */
  const handleEventSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setNotice(null);
    try {
      const cityId = Number(eventForm.cityId);
      await createAdminEvent({
        title: eventForm.title.trim(),
        location: eventForm.location.trim() || null,
        city_id: Number.isFinite(cityId) ? cityId : null,
        start_date: eventForm.startDate || null,
        end_date: eventForm.endDate || null,
      });
      setNotice({ type: "success", text: "イベントを追加しました。" });
      setEventForm((prev) => ({
        ...prev,
        title: "",
        location: "",
        startDate: "",
        endDate: "",
      }));
      setStats(await fetchAdminDashboardStats());
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "イベント追加に失敗しました。",
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * 画像ファイルを Storage へアップロードし、スポットフォームへ設定する。
   *
   * @param file - 選択ファイル
   * @returns Promise<void>
   * @example
   * await handleImageUpload(file);
   */
  const handleImageUpload = async (file: File) => {
    if (!isAdmin) return;
    setSaving(true);
    setNotice(null);
    try {
      const path = await uploadAdminAsset(file, "images/spots", "jpg");
      setSpotForm((prev) => ({ ...prev, imagePath: path }));
      setNotice({ type: "success", text: "画像をアップロードしました。" });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "画像アップロードに失敗しました。",
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * 3Dモデルファイルを Storage へアップロードし、スポットフォームへ設定する。
   *
   * @param file - 選択ファイル
   * @returns Promise<void>
   * @example
   * await handleModelUpload(file);
   */
  const handleModelUpload = async (file: File) => {
    if (!isAdmin) return;
    setSaving(true);
    setNotice(null);
    try {
      const path = await uploadAdminAsset(file, "models/spots", "obj");
      setSpotForm((prev) => ({ ...prev, modelPath: path }));
      setNotice({ type: "success", text: "モデルをアップロードしました。" });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "モデルアップロードに失敗しました。",
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * 利用者ロールを変更する。
   *
   * @param target - 対象ユーザー
   * @param role - 変更後ロール
   * @returns Promise<void>
   * @example
   * await handleRoleChange(user, "admin");
   */
  const handleRoleChange = async (target: AdminUserSummary, role: UserRole) => {
    if (!isSuperAdmin) return;
    if (target.id === currentUser?.id && role !== "super_admin") {
      setNotice({ type: "error", text: "自身の super_admin 権限は解除できません。" });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await updateUserRole(target.id, role);
      setNotice({ type: "success", text: "ユーザー権限を更新しました。" });
      setUsers(await fetchManageableUsers());
      setStats(await fetchAdminDashboardStats());
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "権限更新に失敗しました。",
      });
    } finally {
      setSaving(false);
    }
  };

  const roleBadgeLabel = useMemo(() => {
    if (currentUser?.role === "super_admin") return "Super Admin";
    if (currentUser?.role === "admin") return "Admin";
    return "User";
  }, [currentUser?.role]);

  if (loading || status === "loading") {
    return <p className="text-sm text-zinc-600">管理ポータルを読み込んでいます...</p>;
  }

  if (!currentUser || !isAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <h1 className="text-2xl font-bold text-rose-900">管理者権限が必要です</h1>
        <p className="text-sm text-rose-800">
          現在のアカウントでは管理ポータルを利用できません。管理者に権限付与を依頼してください。
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              signOut().finally(() => router.replace("/admin/login"));
            }}
          >
            別アカウントでログイン
          </Button>
          <Link href="/" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700">
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-900/15 bg-gradient-to-r from-[#0f2027] via-[#203a43] to-[#2c5364] p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">Iwate150 Admin Portal</p>
        <h1 className="mt-1 text-3xl font-bold">管理ダッシュボード</h1>
        <p className="mt-2 text-sm text-emerald-50/90">
          ログイン中: {currentUser.email ?? currentUser.display_name} / {roleBadgeLabel}
        </p>
      </section>

      {notice && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "総ユーザー数", value: stats.totalUsers },
          { label: "7日以内新規", value: stats.newUsersLast7Days },
          { label: "スポット総数", value: stats.totalSpots },
          { label: "イベント総数", value: stats.totalEvents },
          { label: "管理者数", value: stats.totalAdmins },
        ].map((item) => (
          <article key={item.label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">最新スポット</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.latestSpots.length === 0 && <li className="text-zinc-500">データなし</li>}
            {stats.latestSpots.map((spot) => (
              <li key={spot.id} className="rounded-lg border border-zinc-100 px-3 py-2">
                <p className="font-medium text-zinc-900">{spot.name}</p>
                <p className="text-xs text-zinc-500">ID: {spot.id} / city_id: {spot.city_id}</p>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">最新イベント</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.latestEvents.length === 0 && <li className="text-zinc-500">データなし</li>}
            {stats.latestEvents.map((event) => (
              <li key={event.id} className="rounded-lg border border-zinc-100 px-3 py-2">
                <p className="font-medium text-zinc-900">{event.title}</p>
                <p className="text-xs text-zinc-500">
                  ID: {event.id} / {event.start_date ?? "日付未設定"}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={handleSpotSubmit} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">観光スポット追加</h2>
          <input
            required
            value={spotForm.name}
            onChange={(event) => setSpotForm((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="スポット名"
          />
          <textarea
            required
            value={spotForm.description}
            onChange={(event) => setSpotForm((prev) => ({ ...prev, description: event.target.value }))}
            className="h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="説明"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={spotForm.cityId}
              onChange={(event) => setSpotForm((prev) => ({ ...prev, cityId: event.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <select
              value={spotForm.genreId}
              onChange={(event) => setSpotForm((prev) => ({ ...prev, genreId: event.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={spotForm.lat}
              onChange={(event) => setSpotForm((prev) => ({ ...prev, lat: event.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="緯度"
            />
            <input
              required
              value={spotForm.lng}
              onChange={(event) => setSpotForm((prev) => ({ ...prev, lng: event.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="経度"
            />
          </div>
          <input
            value={spotForm.referenceUrl}
            onChange={(event) => setSpotForm((prev) => ({ ...prev, referenceUrl: event.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="参照URL (任意)"
          />
          <input
            value={spotForm.imagePath}
            onChange={(event) => setSpotForm((prev) => ({ ...prev, imagePath: event.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="image_path (Storageパス)"
          />
          <input
            value={spotForm.modelPath}
            onChange={(event) => setSpotForm((prev) => ({ ...prev, modelPath: event.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="model_path (Storageパス)"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-600">
              画像アップロード
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
            </label>
            <label className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-600">
              モデルアップロード
              <input
                type="file"
                accept=".obj,.fbx,.glb,.gltf,.mtl,.ply,.stl"
                className="mt-1 block w-full text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleModelUpload(file);
                }}
              />
            </label>
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            スポットを追加
          </Button>
        </form>

        <form onSubmit={handleEventSubmit} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">イベント追加</h2>
          <input
            required
            value={eventForm.title}
            onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="イベント名"
          />
          <input
            value={eventForm.location}
            onChange={(event) => setEventForm((prev) => ({ ...prev, location: event.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="開催場所"
          />
          <select
            value={eventForm.cityId}
            onChange={(event) => setEventForm((prev) => ({ ...prev, cityId: event.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-600">
              開始日
              <input
                type="date"
                value={eventForm.startDate}
                onChange={(event) => setEventForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-zinc-600">
              終了日
              <input
                type="date"
                value={eventForm.endDate}
                onChange={(event) => setEventForm((prev) => ({ ...prev, endDate: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            イベントを追加
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900">利用者・権限管理</h2>
          {!isSuperAdmin && (
            <span className="text-xs text-zinc-500">権限変更は super_admin のみ可能です</span>
          )}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">表示名</th>
                <th className="px-2 py-2">メール</th>
                <th className="px-2 py-2">現在ロール</th>
                <th className="px-2 py-2">作成日時</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-100">
                  <td className="px-2 py-2 text-zinc-700">{user.id}</td>
                  <td className="px-2 py-2 text-zinc-900">{user.display_name}</td>
                  <td className="px-2 py-2 text-zinc-700">{user.email ?? "-"}</td>
                  <td className="px-2 py-2">
                    <select
                      value={user.role}
                      disabled={!isSuperAdmin || saving}
                      onChange={(event) => {
                        const nextRole = event.target.value as UserRole;
                        handleRoleChange(user, nextRole);
                      }}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-zinc-500">{new Date(user.created_at).toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
