import { normalizePage, normalizePageSize, buildPagedResult, type PagedResult } from "./paging";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IWATE_PUBLIC_BOUNDS } from "./config";
import { mockCities, mockEvents, mockGenres, mockSpots, mockStampCatalog } from "./mockData";
import { getCurrentDateKey, getUpcomingEvents, sortEventsForTimeline } from "./eventFilters";
import {
  City,
  Event,
  Genre,
  Spot,
  StampCatalog,
} from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isBrowser = typeof window !== "undefined";

const hasEnv = Boolean(supabaseUrl && supabaseAnonKey);

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

export type { PagedResult } from "./paging";

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

// ─────────────────────────────────────────────────────────────
// 検索ヘルパー

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

// ─────────────────────────────────────────────────────────────
// 公開データの読み取り

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

// ─────────────────────────────────────────────────────────────
// 公開データの検索

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
  const pageSize = normalizePageSize(params.pageSize, SEARCH_DEFAULT_PAGE_SIZE, SEARCH_MAX_PAGE_SIZE);
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
  const pageSize = normalizePageSize(params.pageSize, SEARCH_DEFAULT_PAGE_SIZE, SEARCH_MAX_PAGE_SIZE);
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

// ─────────────────────────────────────────────────────────────
// 公開スタンプカタログ

/**
 * ID順に公開対象を最後まで取得する。途中失敗・制限超過時は部分一覧を返さない。
 * @param db - 公開データ用クライアント
 * @param signal - カタログ全体のタイムアウト
 * @returns 全対象。取得を完了できなかった場合はnull
 * @example const spots = await loadAllStampSpots(db, controller.signal);
 */
async function loadAllStampSpots(db: SupabaseClient, signal: AbortSignal): Promise<Spot[] | null> {
  const spots: Spot[] = [];
  let lastId: number | undefined;
  // メモリとリクエスト数を制限し、極端に大きい一覧でも無制限に取得しない。
  for (let page = 0; page < 100; page += 1) {
    if (signal.aborted) return null;
    let query = db.from("spots").select("*")
      .not("city_id", "is", null).not("genre_id", "is", null)
      .gte("lat", IWATE_PUBLIC_BOUNDS.minLat).lte("lat", IWATE_PUBLIC_BOUNDS.maxLat)
      .gte("lng", IWATE_PUBLIC_BOUNDS.minLng).lte("lng", IWATE_PUBLIC_BOUNDS.maxLng)
      .order("id").limit(500);
    if (lastId !== undefined) query = query.gt("id", lastId);
    const { data, error } = await query.abortSignal(signal);
    if (error || !data || signal.aborted) return null;
    if (!data.length) return spots;
    const rows = data as Spot[];
    const nextId = rows[rows.length - 1].id;
    if (!Number.isSafeInteger(nextId) || (lastId !== undefined && nextId <= lastId)) return null;
    spots.push(...rows);
    lastId = nextId;
    // サーバー側の件数上限が500未満でも、空ページを得るまで次のIDを取得する。
  }
  return null;
}

/**
 * 公開スタンプ対象を同じ取得結果の市町村と組にして読み込む。
 * @returns データの出所を含む対象。障害時は保存不可のサンプル
 * @example const catalog = await loadStampCatalog();
 */
export async function loadStampCatalog(): Promise<StampCatalog> {
  if (!client) return mockStampCatalog;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const [spots, cities] = await Promise.all([
      loadAllStampSpots(client, controller.signal),
      client.from("cities").select("*").order("id").limit(100).abortSignal(controller.signal),
    ]);
    if (!spots || cities.error || controller.signal.aborted) return mockStampCatalog;
    return { spots, cities: (cities.data ?? []) as City[], isSample: false };
  } catch {
    return mockStampCatalog;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
