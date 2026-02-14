import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { mockCities, mockGenres, mockSpots, mockEvents } from "./mockData";
import { City, Genre, Spot, Event, Stamp, User } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isBrowser = typeof window !== "undefined";

const hasEnv = Boolean(supabaseUrl && supabaseAnonKey);

const client: SupabaseClient | null = hasEnv
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: isBrowser, autoRefreshToken: isBrowser },
    })
  : null;

if (!hasEnv && typeof console !== "undefined") {
  console.warn(
    "[supabaseClient] 環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定のためモックデータを使用します。"
  );
}

export const getSupabaseClient = () => client;

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
  let local = [...mockSpots];
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
  const total = local.length;
  const items = local.slice(from, to + 1);
  return buildPagedResult(items, total, page, pageSize);
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

export async function fetchSpots(): Promise<Spot[]> {
  if (!client) return mockSpots;
  const { data, error } = await client
    .from("spots")
    .select("*")
    .order("id")
    .limit(500);
  if (error) {
    console.warn("[supabase] spots fetch error, fallback to mock", error);
    return mockSpots;
  }
  return data as Spot[];
}

export async function fetchSpot(id: number): Promise<Spot | null> {
  if (!client) return mockSpots.find((s) => s.id === id) ?? null;
  const { data, error } = await client.from("spots").select("*").eq("id", id).single();
  if (error) {
    console.warn("[supabase] spot fetch error, fallback to mock", error);
    return mockSpots.find((s) => s.id === id) ?? null;
  }
  return data as Spot;
}

export async function fetchEvents(): Promise<Event[]> {
  if (!client) return mockEvents;
  const { data, error } = await client
    .from("events")
    .select("*")
    .order("start_date", { ascending: true });
  if (error) {
    console.warn("[supabase] events fetch error, fallback to mock", error);
    return mockEvents;
  }
  return data as Event[];
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

  let query = client.from("spots").select("*", { count: "exact" }).order("id");

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
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

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

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.warn("[supabase] events search error, fallback to mock", error);
    return buildEventMockSearchResult(params, page, pageSize, keyword);
  }
  const safeItems = (data ?? []) as Event[];
  const total = Number.isFinite(count) ? (count as number) : safeItems.length;
  return buildPagedResult(safeItems, total, page, pageSize);
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
    .insert({ auth_id: authId, display_name: displayName })
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
