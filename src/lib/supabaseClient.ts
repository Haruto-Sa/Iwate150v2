import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IWATE_PUBLIC_BOUNDS } from "./config";
import { mockCities, mockEvents, mockFavorites, mockGenres, mockSpots } from "./mockData";
import { getCurrentDateKey, getUpcomingEvents, sortEventsForTimeline } from "./eventFilters";
import {
  AdminDashboardEventSummary,
  AdminDashboardSpotSummary,
  AdminDashboardStats,
  AdminEventCreateInput,
  AdminSpotCreateInput,
  AdminUserSummary,
  City,
  Event,
  Favorite,
  Genre,
  Spot,
  Stamp,
  User,
  UserRole,
} from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isBrowser = typeof window !== "undefined";

const hasEnv = Boolean(supabaseUrl && supabaseAnonKey);
const storageBucket =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
  process.env.SUPABASE_STORAGE_BUCKET ??
  "iwate150data";

const client: SupabaseClient | null = hasEnv
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        flowType: "pkce",
      },
    })
  : null;

if (!hasEnv && typeof console !== "undefined") {
  console.warn(
    "[supabaseClient] 環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定のためモックデータを使用します。"
  );
}

export const getSupabaseClient = () => client;

/**
 * 与えられた値がユーザーロールか判定する。
 *
 * @param value - 判定対象
 * @returns UserRole の場合 true
 * @example
 * isUserRole("admin");
 */
function isUserRole(value: unknown): value is UserRole {
  return value === "user" || value === "admin" || value === "super_admin";
}

/**
 * 管理系書き込み処理で利用する Supabase クライアントを取得する。
 *
 * @returns Supabase client
 * @throws Error Supabase 未設定時
 * @example
 * const writableClient = getWritableClient();
 */
function getWritableClient(): SupabaseClient {
  if (!client) {
    throw new Error("Supabase 設定が未完了のため書き込み機能を利用できません。");
  }
  return client;
}

/**
 * ファイル名を Storage キー向けの ASCII セーフ文字列へ整形する。
 *
 * @param filename - 元ファイル名
 * @returns セーフ化されたベース名（拡張子を除く）
 * @example
 * toSafeFileBase("盛岡の写真.jpg");
 */
function toSafeFileBase(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase();
  const safe = base.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return safe || "asset";
}

/**
 * 拡張子を抽出し、無効な場合は既定値へフォールバックする。
 *
 * @param filename - ファイル名
 * @returns 小文字拡張子（ピリオド除く）
 * @example
 * resolveExtension("spot-photo.PNG", "jpg");
 */
function resolveExtension(filename: string, fallback: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match?.[1] ?? fallback;
}

/**
 * Storage アップロード用オブジェクトパスを生成する。
 *
 * @param folder - 保存先フォルダ
 * @param filename - 元ファイル名
 * @param fallbackExt - 拡張子の既定値
 * @returns Storage object path
 * @example
 * buildAssetPath("images/spots", "sample.jpg", "jpg");
 */
function buildAssetPath(folder: string, filename: string, fallbackExt: string): string {
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, "");
  const safeBase = toSafeFileBase(filename);
  const ext = resolveExtension(filename, fallbackExt);
  const randomToken = Math.random().toString(36).slice(2, 10);
  return `${normalizedFolder}/${Date.now()}-${randomToken}-${safeBase}.${ext}`;
}

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

export type SpotSearchParams = {
  keyword?: string | null;
  cityId?: number | null;
  genreId?: number | null;
  page?: number;
  pageSize?: number;
};

export type EventSearchParams = {
  keyword?: string | null;
  cityId?: number | null;
  page?: number;
  pageSize?: number;
};

export type FetchEventsOptions = {
  includePast?: boolean;
  limit?: number;
  referenceDate?: string;
};

export type FetchSpotsOptions = {
  fallback?: "mock" | "empty";
};

const SEARCH_DEFAULT_PAGE_SIZE = 50;
const SEARCH_MAX_PAGE_SIZE = 100;
const SEARCH_MAX_KEYWORD_LENGTH = 100;

/**
 * 検索キーワードを正規化する。
 *
 * PostgREST の `or(...)` 構文を壊しやすい文字を抑制し、長さ上限を適用する。
 *
 * @param value - 生のキーワード
 * @returns 正規化済みキーワード
 * @example
 * const keyword = normalizeKeyword("  盛岡,城跡  ");
 */
function normalizeKeyword(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().slice(0, SEARCH_MAX_KEYWORD_LENGTH).replace(/[(),]/g, " ").trim();
}

/**
 * ILIKE 検索向けにワイルドカードをエスケープする。
 *
 * @param value - キーワード
 * @returns `%` と `_` をエスケープ済みの文字列
 * @example
 * const escaped = escapeForIlike("100%_test");
 */
function escapeForIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * ページ番号を安全な範囲に正規化する。
 *
 * @param value - 入力ページ番号
 * @returns 1以上のページ番号
 * @example
 * const page = normalizePage(0);
 */
function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value as number));
}

/**
 * ページサイズを安全な範囲に正規化する。
 *
 * @param value - 入力ページサイズ
 * @returns 1〜SEARCH_MAX_PAGE_SIZE のページサイズ
 * @example
 * const pageSize = normalizePageSize(50);
 */
function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return SEARCH_DEFAULT_PAGE_SIZE;
  const safe = Math.floor(value as number);
  return Math.min(SEARCH_MAX_PAGE_SIZE, Math.max(1, safe));
}

/**
 * ページング結果を構築する。
 *
 * @param items - 現在ページのアイテム
 * @param total - 総件数
 * @param page - 現在ページ
 * @param pageSize - ページサイズ
 * @returns ページング結果
 * @example
 * const result = buildPagedResult([], 0, 1, 50);
 */
function buildPagedResult<T>(items: T[], total: number, page: number, pageSize: number): PagedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  };
}

/**
 * モックデータでスポット検索結果を作る。
 *
 * @param params - 検索条件
 * @param page - ページ番号
 * @param pageSize - ページサイズ
 * @param keyword - 正規化済みキーワード
 * @returns ページング付きスポット配列
 * @example
 * const result = buildSpotMockSearchResult({}, 1, 50, "");
 */
function buildSpotMockSearchResult(
  params: SpotSearchParams,
  page: number,
  pageSize: number,
  keyword: string
): PagedResult<Spot> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let local = [...getPublicMockSpots()];
  if (params.cityId) local = local.filter((spot) => spot.city_id === params.cityId);
  if (params.genreId) local = local.filter((spot) => spot.genre_id === params.genreId);
  if (keyword) {
    const lower = keyword.toLowerCase();
    local = local.filter(
      (spot) => spot.name.toLowerCase().includes(lower) || spot.description.toLowerCase().includes(lower)
    );
  }
  const total = local.length;
  const items = local.slice(from, to + 1);
  return buildPagedResult(items, total, page, pageSize);
}

/**
 * モックデータでイベント検索結果を作る。
 *
 * @param params - 検索条件
 * @param page - ページ番号
 * @param pageSize - ページサイズ
 * @param keyword - 正規化済みキーワード
 * @returns ページング付きイベント配列
 * @example
 * const result = buildEventMockSearchResult({}, 1, 50, "");
 */
function buildEventMockSearchResult(
  params: EventSearchParams,
  page: number,
  pageSize: number,
  keyword: string
): PagedResult<Event> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let local = [...mockEvents];
  if (params.cityId) local = local.filter((event) => event.city_id === params.cityId);
  if (keyword) {
    const lower = keyword.toLowerCase();
    local = local.filter(
      (event) =>
        event.title.toLowerCase().includes(lower) ||
        (event.location ?? "").toLowerCase().includes(lower)
    );
  }
  local = sortEventsForTimeline(local);
  const total = local.length;
  const items = local.slice(from, to + 1);
  return buildPagedResult(items, total, page, pageSize);
}

/**
 * 公開画面に出してよいスポットか判定する。
 *
 * `spots` テーブルに公開フラグがないため、現状は
 * 市区町村・ジャンルが紐づき、岩手県内の妥当な座標を持つものだけを公開対象とする。
 *
 * @param spot - 判定対象スポット
 * @returns 公開可能なら true
 * @example
 * isPublicSpot(mockSpots[0]);
 */
function isPublicSpot(spot: Spot): boolean {
  if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) return false;
  if (spot.city_id == null || spot.genre_id == null) return false;

  return (
    spot.lat >= IWATE_PUBLIC_BOUNDS.minLat &&
    spot.lat <= IWATE_PUBLIC_BOUNDS.maxLat &&
    spot.lng >= IWATE_PUBLIC_BOUNDS.minLng &&
    spot.lng <= IWATE_PUBLIC_BOUNDS.maxLng
  );
}

/**
 * 公開条件に一致するスポット配列だけを返す。
 *
 * @param spots - 元スポット配列
 * @returns 公開可能なスポット配列
 * @example
 * const safeSpots = filterPublicSpots(mockSpots);
 */
function filterPublicSpots(spots: Spot[]): Spot[] {
  return spots.filter(isPublicSpot);
}

/**
 * モックデータから公開条件に一致するスポット一覧を返す。
 *
 * @returns 公開可能なモックスポット配列
 * @example
 * const fallbackSpots = getPublicMockSpots();
 */
function getPublicMockSpots(): Spot[] {
  return filterPublicSpots(mockSpots);
}

export async function fetchCities(): Promise<City[]> {
  if (!client) return mockCities;
  const { data, error } = await client.from("cities").select("*").order("id");
  if (error) {
    console.warn("[supabase] cities fetch error, fallback to mock", error);
    return mockCities;
  }
  return data as City[];
}

export async function fetchGenres(): Promise<Genre[]> {
  if (!client) return mockGenres;
  const { data, error } = await client.from("genres").select("*").order("id");
  if (error) {
    console.warn("[supabase] genres fetch error, fallback to mock", error);
    return mockGenres;
  }
  return data as Genre[];
}

/**
 * 公開向けスポット一覧を取得する。
 *
 * 既定では Supabase 取得失敗時にモックへフォールバックするが、
 * 画面要件に応じて空配列を返す厳格モードへ切り替えられる。
 *
 * @param options - フォールバック設定
 * @returns スポット配列
 * @example
 * await fetchSpots({ fallback: "empty" });
 */
export async function fetchSpots(options: FetchSpotsOptions = {}): Promise<Spot[]> {
  const fallbackMode = options.fallback ?? "mock";
  if (!client) {
    return fallbackMode === "empty" ? [] : getPublicMockSpots();
  }
  const { data, error } = await client
    .from("spots")
    .select("*")
    .not("city_id", "is", null)
    .not("genre_id", "is", null)
    .gte("lat", IWATE_PUBLIC_BOUNDS.minLat)
    .lte("lat", IWATE_PUBLIC_BOUNDS.maxLat)
    .gte("lng", IWATE_PUBLIC_BOUNDS.minLng)
    .lte("lng", IWATE_PUBLIC_BOUNDS.maxLng)
    .order("id")
    .limit(500);
  if (error) {
    console.warn("[supabase] spots fetch error, fallback to mock", error);
    return fallbackMode === "empty" ? [] : getPublicMockSpots();
  }
  return (data ?? []) as Spot[];
}

export async function fetchSpot(id: number): Promise<Spot | null> {
  const fallbackSpot = getPublicMockSpots().find((spot) => spot.id === id) ?? null;
  if (!client) return fallbackSpot;
  const { data, error } = await client
    .from("spots")
    .select("*")
    .eq("id", id)
    .not("city_id", "is", null)
    .not("genre_id", "is", null)
    .gte("lat", IWATE_PUBLIC_BOUNDS.minLat)
    .lte("lat", IWATE_PUBLIC_BOUNDS.maxLat)
    .gte("lng", IWATE_PUBLIC_BOUNDS.minLng)
    .lte("lng", IWATE_PUBLIC_BOUNDS.maxLng)
    .maybeSingle();
  if (error) {
    console.warn("[supabase] spot fetch error, fallback to mock", error);
    return fallbackSpot;
  }
  return (data as Spot | null) ?? null;
}

/**
 * イベント一覧を取得する。
 *
 * 既定では開催予定/開催中イベントのみ返し、必要に応じて過去イベントを含める。
 *
 * @param options - 取得オプション
 * @returns イベント配列
 * @example
 * await fetchEvents({ includePast: true, limit: 20 });
 */
export async function fetchEvents(options: FetchEventsOptions = {}): Promise<Event[]> {
  const referenceDate = options.referenceDate ?? getCurrentDateKey();

  /**
   * 取得済みイベントへ共通のフィルタ・件数制限を適用する。
   *
   * @param events - 元イベント配列
   * @returns 整形済みイベント配列
   * @example
   * applyEventFilters(mockEvents);
   */
  function applyEventFilters(events: Event[]): Event[] {
    const base = options.includePast
      ? sortEventsForTimeline(events, referenceDate)
      : getUpcomingEvents(events, referenceDate);
    return typeof options.limit === "number" ? base.slice(0, options.limit) : base;
  }

  if (!client) return applyEventFilters(mockEvents);
  const { data, error } = await client
    .from("events")
    .select("*")
    .order("start_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.warn("[supabase] events fetch error, fallback to mock", error);
    return applyEventFilters(mockEvents);
  }
  return applyEventFilters((data ?? []) as Event[]);
}

/**
 * スポットを DB で検索する（市区町村・ジャンル・キーワード + ページング）。
 *
 * @param params - 検索条件
 * @returns ページング付きスポット配列
 * @example
 * const result = await searchSpots({ keyword: "温泉", cityId: 1, page: 1, pageSize: 50 });
 */
export async function searchSpots(params: SpotSearchParams): Promise<PagedResult<Spot>> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const keyword = normalizeKeyword(params.keyword);

  if (!client) {
    return buildSpotMockSearchResult(params, page, pageSize, keyword);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("spots")
    .select("*", { count: "exact" })
    .not("city_id", "is", null)
    .not("genre_id", "is", null)
    .gte("lat", IWATE_PUBLIC_BOUNDS.minLat)
    .lte("lat", IWATE_PUBLIC_BOUNDS.maxLat)
    .gte("lng", IWATE_PUBLIC_BOUNDS.minLng)
    .lte("lng", IWATE_PUBLIC_BOUNDS.maxLng)
    .order("id");

  if (params.cityId) query = query.eq("city_id", params.cityId);
  if (params.genreId) query = query.eq("genre_id", params.genreId);
  if (keyword) {
    const escaped = escapeForIlike(keyword);
    const pattern = `%${escaped}%`;
    query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.warn("[supabase] spots search error, fallback to mock", error);
    return buildSpotMockSearchResult(params, page, pageSize, keyword);
  }
  const safeItems = (data ?? []) as Spot[];
  const total = Number.isFinite(count) ? (count as number) : safeItems.length;
  return buildPagedResult(safeItems, total, page, pageSize);
}

/**
 * イベントを DB で検索する（市区町村・キーワード + ページング）。
 *
 * @param params - 検索条件
 * @returns ページング付きイベント配列
 * @example
 * const result = await searchEvents({ keyword: "祭", cityId: 1, page: 1, pageSize: 50 });
 */
export async function searchEvents(params: EventSearchParams): Promise<PagedResult<Event>> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const keyword = normalizeKeyword(params.keyword);

  if (!client) {
    return buildEventMockSearchResult(params, page, pageSize, keyword);
  }
  let query = client
    .from("events")
    .select("*", { count: "exact" })
    .order("start_date", { ascending: true })
    .order("id", { ascending: true });

  if (params.cityId) query = query.eq("city_id", params.cityId);
  if (keyword) {
    const escaped = escapeForIlike(keyword);
    const pattern = `%${escaped}%`;
    query = query.or(`title.ilike.${pattern},location.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) {
    console.warn("[supabase] events search error, fallback to mock", error);
    return buildEventMockSearchResult(params, page, pageSize, keyword);
  }
  const safeItems = sortEventsForTimeline((data ?? []) as Event[]);
  const total = Number.isFinite(count) ? (count as number) : safeItems.length;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  return buildPagedResult(safeItems.slice(from, to), total, page, pageSize);
}

/**
 * 認証ユーザーから表示名を導出する。
 *
 * @param email - メールアドレス
 * @returns 表示名
 * @example
 * const name = deriveDisplayNameFromEmail("user@example.com");
 */
function deriveDisplayNameFromEmail(email: string | null | undefined): string {
  if (!email) return "User";
  const name = email.split("@")[0];
  return name || "User";
}

/**
 * 現在ログイン中ユーザーの `public.users` 情報を取得する。
 *
 * レコード未作成時は `public.users` に最小情報で作成し、再取得して返す。
 *
 * @returns 現在ユーザーのアプリプロフィール。未ログイン/取得失敗時は null
 * @example
 * const appUser = await fetchCurrentAppUser();
 */
export async function fetchCurrentAppUser(): Promise<User | null> {
  if (!client) return null;
  const {
    data: { session },
  } = await client.auth.getSession();
  const authUser = session?.user;
  if (!authUser) return null;

  const writableClient = getWritableClient();
  const { data: existing, error: existingError } = await writableClient
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (existingError) {
    console.warn("[supabase] current app user fetch error:", existingError);
    return null;
  }
  if (existing) {
    return existing as User;
  }

  const inserted = await writableClient
    .from("users")
    .insert({
      auth_id: authUser.id,
      email: authUser.email ?? null,
      display_name: deriveDisplayNameFromEmail(authUser.email),
      role: "user",
    })
    .select("*")
    .single();

  if (inserted.error) {
    console.warn("[supabase] current app user insert error:", inserted.error);
    return null;
  }
  return inserted.data as User;
}

/**
 * 管理ダッシュボード表示用の集計値を取得する。
 *
 * @returns 管理ダッシュボード統計。Supabase未接続/取得失敗時はゼロ値
 * @example
 * const stats = await fetchAdminDashboardStats();
 */
export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const fallback: AdminDashboardStats = {
    totalUsers: 0,
    newUsersLast7Days: 0,
    totalSpots: 0,
    totalEvents: 0,
    totalAdmins: 0,
    latestSpots: [],
    latestEvents: [],
  };

  if (!client) return fallback;

  const writableClient = getWritableClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsersRes,
    newUsersRes,
    totalSpotsRes,
    totalEventsRes,
    totalAdminsRes,
    latestSpotsRes,
    latestEventsRes,
  ] = await Promise.all([
    writableClient.from("users").select("*", { head: true, count: "exact" }),
    writableClient.from("users").select("*", { head: true, count: "exact" }).gte("created_at", sevenDaysAgo),
    writableClient.from("spots").select("*", { head: true, count: "exact" }),
    writableClient.from("events").select("*", { head: true, count: "exact" }),
    writableClient
      .from("users")
      .select("*", { head: true, count: "exact" })
      .in("role", ["admin", "super_admin"]),
    writableClient.from("spots").select("id,name,city_id").order("id", { ascending: false }).limit(5),
    writableClient
      .from("events")
      .select("id,title,city_id,start_date")
      .order("id", { ascending: false })
      .limit(5),
  ]);

  const hasError = [
    totalUsersRes.error,
    newUsersRes.error,
    totalSpotsRes.error,
    totalEventsRes.error,
    totalAdminsRes.error,
    latestSpotsRes.error,
    latestEventsRes.error,
  ].some(Boolean);

  if (hasError) {
    console.warn("[supabase] admin dashboard stats fetch error", {
      totalUsersError: totalUsersRes.error?.message,
      newUsersError: newUsersRes.error?.message,
      totalSpotsError: totalSpotsRes.error?.message,
      totalEventsError: totalEventsRes.error?.message,
      totalAdminsError: totalAdminsRes.error?.message,
      latestSpotsError: latestSpotsRes.error?.message,
      latestEventsError: latestEventsRes.error?.message,
    });
    return fallback;
  }

  return {
    totalUsers: totalUsersRes.count ?? 0,
    newUsersLast7Days: newUsersRes.count ?? 0,
    totalSpots: totalSpotsRes.count ?? 0,
    totalEvents: totalEventsRes.count ?? 0,
    totalAdmins: totalAdminsRes.count ?? 0,
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
  if (!client) return [];
  const writableClient = getWritableClient();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
  const { data, error } = await writableClient
    .from("users")
    .select("id,auth_id,email,display_name,role,created_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.warn("[supabase] manageable users fetch error:", error);
    return [];
  }
  return (data ?? []) as AdminUserSummary[];
}

/**
 * 管理画面から新規スポットを作成する。
 *
 * @param input - 作成パラメータ
 * @returns 作成されたスポット
 * @throws Error Supabase未設定または作成失敗時
 * @example
 * await createAdminSpot({ ...spotInput });
 */
export async function createAdminSpot(input: AdminSpotCreateInput): Promise<Spot> {
  const writableClient = getWritableClient();
  const payload = {
    name: input.name,
    description: input.description,
    city_id: input.city_id,
    genre_id: input.genre_id,
    lat: input.lat,
    lng: input.lng,
    image_thumb_path: input.image_thumb_path ?? null,
    image_path: input.image_path ?? null,
    model_path: input.model_path ?? null,
    reference_url: input.reference_url ?? null,
  };
  const { data, error } = await writableClient.from("spots").insert(payload).select("*").single();
  if (error || !data) {
    throw new Error(error?.message ?? "スポットの作成に失敗しました。");
  }
  return data as Spot;
}

/**
 * 管理画面から新規イベントを作成する。
 *
 * @param input - 作成パラメータ
 * @returns 作成されたイベント
 * @throws Error Supabase未設定または作成失敗時
 * @example
 * await createAdminEvent({ ...eventInput });
 */
export async function createAdminEvent(input: AdminEventCreateInput): Promise<Event> {
  const writableClient = getWritableClient();
  const payload = {
    title: input.title,
    location: input.location ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    city_id: input.city_id ?? null,
  };
  const { data, error } = await writableClient.from("events").insert(payload).select("*").single();
  if (error || !data) {
    throw new Error(error?.message ?? "イベントの作成に失敗しました。");
  }
  return data as Event;
}

/**
 * ユーザーのロールを更新する。
 *
 * @param userId - 対象ユーザー ID
 * @param role - 変更先ロール
 * @returns 更新後ユーザー情報
 * @throws Error 入力不正または更新失敗時
 * @example
 * await updateUserRole(42, "admin");
 */
export async function updateUserRole(userId: number, role: UserRole): Promise<AdminUserSummary> {
  if (!isUserRole(role)) {
    throw new Error("不正なロールです。");
  }
  const writableClient = getWritableClient();
  const { data, error } = await writableClient
    .from("users")
    .update({ role })
    .eq("id", userId)
    .select("id,auth_id,email,display_name,role,created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "ユーザー権限の更新に失敗しました。");
  }
  return data as AdminUserSummary;
}

/**
 * 管理画面から画像/モデルを Supabase Storage へアップロードする。
 *
 * @param file - アップロード対象ファイル
 * @param folder - 保存先フォルダ（例: `images/spots`, `models/spots`）
 * @param fallbackExt - 拡張子の既定値
 * @returns 保存した Storage object path
 * @throws Error Supabase未設定またはアップロード失敗時
 * @example
 * const path = await uploadAdminAsset(file, "images/spots", "jpg");
 */
export async function uploadAdminAsset(
  file: File,
  folder: string,
  fallbackExt: string
): Promise<string> {
  const writableClient = getWritableClient();
  const objectPath = buildAssetPath(folder, file.name, fallbackExt);
  const { error } = await writableClient.storage.from(storageBucket).upload(objectPath, file, {
    upsert: false,
    contentType: file.type || undefined,
    cacheControl: "3600",
  });
  if (error) {
    throw new Error(error.message);
  }
  return objectPath;
}

// ─────────────────────────────────────────────────────────────
// User / Stamp functions
// ─────────────────────────────────────────────────────────────

/**
 * Get or create public.users record for an auth user
 */
export async function ensurePublicUser(authId: string, email: string): Promise<User | null> {
  if (!client) return null;

  // Check if user exists
  const { data: existing } = await client
    .from("users")
    .select("*")
    .eq("auth_id", authId)
    .single();

  if (existing) {
    return existing as User;
  }

  // Create new user record
  const displayName = email.split("@")[0] || "User";
  const { data: newUser, error } = await client
    .from("users")
    .insert({ auth_id: authId, email, role: "user", display_name: displayName })
    .select()
    .single();

  if (error) {
    console.error("[ensurePublicUser] insert error:", error);
    return null;
  }

  return newUser as User;
}

/**
 * Get public.users.id from auth_id
 */
export async function getPublicUserId(authId: string): Promise<number | null> {
  if (!client) return null;

  const { data } = await client
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .single();

  return data?.id ?? null;
}

/**
 * Fetch all stamps for a user
 */
export async function fetchUserStamps(userId: number): Promise<Stamp[]> {
  if (!client) return [];

  const { data, error } = await client
    .from("stamps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[supabase] stamps fetch error:", error);
    return [];
  }

  return data as Stamp[];
}

/**
 * Check if user already has a stamp for a spot
 */
export async function hasStamp(userId: number, spotId: number): Promise<boolean> {
  if (!client) return false;

  const { data } = await client
    .from("stamps")
    .select("id")
    .eq("user_id", userId)
    .eq("spot_id", spotId)
    .single();

  return Boolean(data);
}

/**
 * Create a new stamp (if not already exists)
 */
export async function createStamp(userId: number, spotId: number): Promise<Stamp | null> {
  if (!client) return null;

  // Check for duplicate
  const exists = await hasStamp(userId, spotId);
  if (exists) {
    console.warn("[createStamp] stamp already exists");
    return null;
  }

  const { data, error } = await client
    .from("stamps")
    .insert({ user_id: userId, spot_id: spotId })
    .select()
    .single();

  if (error) {
    console.error("[createStamp] insert error:", error);
    return null;
  }

  return data as Stamp;
}

/**
 * ユーザーのお気に入り一覧を取得する。
 *
 * @param userId - public.users.id
 * @returns お気に入り配列
 * @example
 * await fetchUserFavorites(8);
 */
export async function fetchUserFavorites(userId: number): Promise<Favorite[]> {
  if (!client) return mockFavorites;

  const { data, error } = await client
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[supabase] favorites fetch error:", error);
    return mockFavorites;
  }

  return (data ?? []) as Favorite[];
}

/**
 * お気に入りを追加する。
 *
 * @param userId - public.users.id
 * @param spotId - spot id
 * @returns 登録レコード
 * @example
 * await addFavorite(3, 10);
 */
export async function addFavorite(userId: number, spotId: number): Promise<Favorite | null> {
  if (!client) return null;

  const { data, error } = await client
    .from("favorites")
    .upsert({ user_id: userId, spot_id: spotId }, { onConflict: "user_id,spot_id" })
    .select("*")
    .single();

  if (error) {
    console.warn("[supabase] favorite insert error:", error);
    return null;
  }

  return data as Favorite;
}

/**
 * お気に入りを削除する。
 *
 * @param userId - public.users.id
 * @param spotId - spot id
 * @returns 削除成功時 true
 * @example
 * await removeFavorite(3, 10);
 */
export async function removeFavorite(userId: number, spotId: number): Promise<boolean> {
  if (!client) return false;

  const { error } = await client
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("spot_id", spotId);

  if (error) {
    console.warn("[supabase] favorite delete error:", error);
    return false;
  }

  return true;
}

/**
 * guest から持ち込んだお気に入りをまとめて同期する。
 *
 * @param userId - public.users.id
 * @param spotIds - 同期対象 spot id 配列
 * @returns 同期後のお気に入り配列
 * @example
 * await mergeFavorites(userId, [1, 2, 3]);
 */
export async function mergeFavorites(userId: number, spotIds: number[]): Promise<Favorite[]> {
  if (!client) return mockFavorites;

  const uniqueSpotIds = [...new Set(spotIds.filter((spotId) => Number.isFinite(spotId) && spotId > 0))];
  if (uniqueSpotIds.length === 0) {
    return fetchUserFavorites(userId);
  }

  const payload = uniqueSpotIds.map((spotId) => ({ user_id: userId, spot_id: spotId }));
  const { error } = await client
    .from("favorites")
    .upsert(payload, { onConflict: "user_id,spot_id", ignoreDuplicates: true });

  if (error) {
    console.warn("[supabase] favorites merge error:", error);
  }

  return fetchUserFavorites(userId);
}
