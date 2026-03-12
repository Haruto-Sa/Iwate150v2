import type { PostgrestError } from "@supabase/supabase-js";
import { getServerAdminClient } from "@/lib/authServer";
import { mockCities, mockEvents, mockGenres, mockSpots } from "@/lib/mockData";
import type {
  AdminEventCreateInput,
  AdminEventListItem,
  AdminEventUpdateInput,
  AdminListPage,
  AdminSpotCreateInput,
  AdminSpotListItem,
  AdminSpotUpdateInput,
  Event,
  Spot,
} from "@/lib/types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * 管理サーバー設定不備を表すエラー。
 */
export class AdminServerConfigError extends Error {
  constructor(message = "管理用 Supabase 設定が不足しています。") {
    super(message);
    this.name = "AdminServerConfigError";
  }
}

/**
 * 管理対象レコード未検出を表すエラー。
 */
export class AdminServerNotFoundError extends Error {
  constructor(message = "対象データが見つかりません。") {
    super(message);
    this.name = "AdminServerNotFoundError";
  }
}

/**
 * ページ番号を安全な値へ正規化する。
 *
 * @param page - 入力ページ番号
 * @returns 1 以上のページ番号
 * @example
 * normalizePage(0);
 */
function normalizePage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

/**
 * ページサイズを安全な範囲へ正規化する。
 *
 * @param pageSize - 入力ページサイズ
 * @returns 1〜MAX_PAGE_SIZE のページサイズ
 * @example
 * normalizePageSize(20);
 */
function normalizePageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));
}

/**
 * 管理一覧用のページング結果を組み立てる。
 *
 * @param items - 現在ページの項目
 * @param total - 総件数
 * @param page - 現在ページ番号
 * @param pageSize - ページサイズ
 * @returns ページング結果
 * @example
 * buildPagedResult([], 0, 1, 20);
 */
function buildPagedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): AdminListPage<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  };
}

/**
 * 管理用 Supabase クライアントを返す。
 *
 * @returns service_role client
 * @throws AdminServerConfigError 未設定時
 * @example
 * const client = getRequiredAdminClient();
 */
function getRequiredAdminClient() {
  const client = getServerAdminClient();
  if (!client) {
    throw new AdminServerConfigError();
  }
  return client;
}

/**
 * PostgREST の not found エラーか判定する。
 *
 * @param error - Supabase エラー
 * @returns not found の場合 true
 * @example
 * isNotFoundError(error);
 */
function isNotFoundError(error: PostgrestError | null): boolean {
  return error?.code === "PGRST116";
}

/**
 * スポット一覧用のモック行を構築する。
 *
 * @param spot - モックスポット
 * @returns 管理一覧行
 * @example
 * buildMockSpotListItem(mockSpots[0]);
 */
function buildMockSpotListItem(spot: Spot): AdminSpotListItem {
  const city = mockCities.find((item) => item.id === spot.city_id);
  const genre = mockGenres.find((item) => item.id === spot.genre_id);
  return {
    ...spot,
    city: city
      ? {
          id: city.id,
          name: city.name,
        }
      : null,
    genre: genre
      ? {
          id: genre.id,
          name: genre.name,
        }
      : null,
  };
}

/**
 * イベント一覧用のモック行を構築する。
 *
 * @param event - モックイベント
 * @returns 管理一覧行
 * @example
 * buildMockEventListItem(mockEvents[0]);
 */
function buildMockEventListItem(event: Event): AdminEventListItem {
  const city = typeof event.city_id === "number" ? mockCities.find((item) => item.id === event.city_id) : null;
  return {
    ...event,
    city: city
      ? {
          id: city.id,
          name: city.name,
        }
      : null,
  };
}

/**
 * 1件関連データを配列/単体どちらでも安全に取り出す。
 *
 * @param value - Supabase 関連データ
 * @returns 単一関連データまたは null
 * @example
 * normalizeSingleRelation([{ id: 1, name: "盛岡市" }]);
 */
function normalizeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Supabase のスポット一覧行を UI 用型へ整形する。
 *
 * @param row - 生の一覧行
 * @returns 整形済み一覧行
 * @example
 * mapSpotListItem(row);
 */
function mapSpotListItem(row: Record<string, unknown>): AdminSpotListItem {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    city_id: Number(row.city_id),
    genre_id: Number(row.genre_id),
    lat: Number(row.lat),
    lng: Number(row.lng),
    image_thumb_path: (row.image_thumb_path as string | null | undefined) ?? null,
    image_path: (row.image_path as string | null | undefined) ?? null,
    model_path: (row.model_path as string | null | undefined) ?? null,
    reference_url: (row.reference_url as string | null | undefined) ?? null,
    city: normalizeSingleRelation(row.city as { id: number; name: string } | { id: number; name: string }[] | null),
    genre: normalizeSingleRelation(
      row.genre as { id: number; name: string } | { id: number; name: string }[] | null
    ),
  };
}

/**
 * Supabase のイベント一覧行を UI 用型へ整形する。
 *
 * @param row - 生の一覧行
 * @returns 整形済み一覧行
 * @example
 * mapEventListItem(row);
 */
function mapEventListItem(row: Record<string, unknown>): AdminEventListItem {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    location: (row.location as string | null | undefined) ?? null,
    start_date: (row.start_date as string | null | undefined) ?? null,
    end_date: (row.end_date as string | null | undefined) ?? null,
    city_id:
      row.city_id === null || row.city_id === undefined || row.city_id === ""
        ? null
        : Number(row.city_id),
    city: normalizeSingleRelation(row.city as { id: number; name: string } | { id: number; name: string }[] | null),
  };
}

/**
 * スポット作成 payload を整形する。
 *
 * @param input - 入力値
 * @returns Supabase 書き込み payload
 * @example
 * toSpotInsertPayload(input);
 */
function toSpotInsertPayload(input: AdminSpotCreateInput) {
  return {
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
}

/**
 * スポット更新 payload を整形する。
 *
 * @param input - 入力値
 * @returns Supabase 書き込み payload
 * @example
 * toSpotUpdatePayload({ name: "盛岡城跡公園" });
 */
function toSpotUpdatePayload(input: AdminSpotUpdateInput) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.city_id !== undefined) payload.city_id = input.city_id;
  if (input.genre_id !== undefined) payload.genre_id = input.genre_id;
  if (input.lat !== undefined) payload.lat = input.lat;
  if (input.lng !== undefined) payload.lng = input.lng;
  if (input.image_thumb_path !== undefined) payload.image_thumb_path = input.image_thumb_path ?? null;
  if (input.image_path !== undefined) payload.image_path = input.image_path ?? null;
  if (input.model_path !== undefined) payload.model_path = input.model_path ?? null;
  if (input.reference_url !== undefined) payload.reference_url = input.reference_url ?? null;
  return payload;
}

/**
 * イベント作成 payload を整形する。
 *
 * @param input - 入力値
 * @returns Supabase 書き込み payload
 * @example
 * toEventInsertPayload(input);
 */
function toEventInsertPayload(input: AdminEventCreateInput) {
  return {
    title: input.title,
    location: input.location ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    city_id: input.city_id ?? null,
  };
}

/**
 * イベント更新 payload を整形する。
 *
 * @param input - 入力値
 * @returns Supabase 書き込み payload
 * @example
 * toEventUpdatePayload({ title: "盛岡ナイトマーケット" });
 */
function toEventUpdatePayload(input: AdminEventUpdateInput) {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.location !== undefined) payload.location = input.location ?? null;
  if (input.start_date !== undefined) payload.start_date = input.start_date ?? null;
  if (input.end_date !== undefined) payload.end_date = input.end_date ?? null;
  if (input.city_id !== undefined) payload.city_id = input.city_id ?? null;
  return payload;
}

/**
 * 管理用スポット一覧をページ単位で取得する。
 *
 * @param page - ページ番号
 * @param pageSize - ページサイズ
 * @returns スポット一覧
 * @example
 * await fetchAdminSpotsPage(1, 20);
 */
export async function fetchAdminSpotsPage(
  page: number,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<AdminListPage<AdminSpotListItem>> {
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const client = getServerAdminClient();

  if (!client) {
    const local = [...mockSpots].sort((left, right) => right.id - left.id).map(buildMockSpotListItem);
    return buildPagedResult(local.slice(from, to + 1), local.length, safePage, safePageSize);
  }

  const { data, error, count } = await client
    .from("spots")
    .select(
      "id,name,description,city_id,genre_id,lat,lng,image_thumb_path,image_path,model_path,reference_url,city:cities(id,name),genre:genres(id,name)",
      { count: "exact" }
    )
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map((row) => mapSpotListItem(row as Record<string, unknown>));
  return buildPagedResult(items, count ?? 0, safePage, safePageSize);
}

/**
 * 管理用の単一スポットを取得する。
 *
 * @param id - スポット ID
 * @returns スポット
 * @example
 * await fetchAdminSpotById(12);
 */
export async function fetchAdminSpotById(id: number): Promise<Spot | null> {
  const client = getServerAdminClient();
  if (!client) {
    return mockSpots.find((spot) => spot.id === id) ?? null;
  }

  const { data, error } = await client.from("spots").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as Spot | null) ?? null;
}

/**
 * スポットを作成する。
 *
 * @param input - 作成入力値
 * @returns 作成後スポット
 * @example
 * await createSpot(input);
 */
export async function createSpot(input: AdminSpotCreateInput): Promise<Spot> {
  const client = getRequiredAdminClient();
  const { data, error } = await client
    .from("spots")
    .insert(toSpotInsertPayload(input))
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "スポットの作成に失敗しました。");
  }
  return data as Spot;
}

/**
 * スポットを更新する。
 *
 * @param id - スポット ID
 * @param input - 更新入力値
 * @returns 更新後スポット
 * @throws AdminServerNotFoundError 対象なし
 * @example
 * await updateSpot(12, { name: "新名称" });
 */
export async function updateSpot(id: number, input: AdminSpotUpdateInput): Promise<Spot> {
  const client = getRequiredAdminClient();
  const payload = toSpotUpdatePayload(input);
  const { data, error } = await client
    .from("spots")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isNotFoundError(error)) {
      throw new AdminServerNotFoundError("更新対象のスポットが見つかりません。");
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new AdminServerNotFoundError("更新対象のスポットが見つかりません。");
  }
  return data as Spot;
}

/**
 * スポットを削除する。
 *
 * @param id - スポット ID
 * @returns void
 * @throws AdminServerNotFoundError 対象なし
 * @example
 * await deleteSpot(12);
 */
export async function deleteSpot(id: number): Promise<void> {
  const client = getRequiredAdminClient();
  const { data, error } = await client
    .from("spots")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isNotFoundError(error)) {
      throw new AdminServerNotFoundError("削除対象のスポットが見つかりません。");
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new AdminServerNotFoundError("削除対象のスポットが見つかりません。");
  }
}

/**
 * 管理用イベント一覧をページ単位で取得する。
 *
 * @param page - ページ番号
 * @param pageSize - ページサイズ
 * @returns イベント一覧
 * @example
 * await fetchAdminEventsPage(1, 20);
 */
export async function fetchAdminEventsPage(
  page: number,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<AdminListPage<AdminEventListItem>> {
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const client = getServerAdminClient();

  if (!client) {
    const local = [...mockEvents].sort((left, right) => right.id - left.id).map(buildMockEventListItem);
    return buildPagedResult(local.slice(from, to + 1), local.length, safePage, safePageSize);
  }

  const { data, error, count } = await client
    .from("events")
    .select("id,title,location,start_date,end_date,city_id,city:cities(id,name)", { count: "exact" })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map((row) => mapEventListItem(row as Record<string, unknown>));
  return buildPagedResult(items, count ?? 0, safePage, safePageSize);
}

/**
 * 管理用の単一イベントを取得する。
 *
 * @param id - イベント ID
 * @returns イベント
 * @example
 * await fetchAdminEventById(8);
 */
export async function fetchAdminEventById(id: number): Promise<Event | null> {
  const client = getServerAdminClient();
  if (!client) {
    return mockEvents.find((event) => event.id === id) ?? null;
  }

  const { data, error } = await client.from("events").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as Event | null) ?? null;
}

/**
 * イベントを作成する。
 *
 * @param input - 作成入力値
 * @returns 作成後イベント
 * @example
 * await createEvent(input);
 */
export async function createEvent(input: AdminEventCreateInput): Promise<Event> {
  const client = getRequiredAdminClient();
  const { data, error } = await client
    .from("events")
    .insert(toEventInsertPayload(input))
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "イベントの作成に失敗しました。");
  }
  return data as Event;
}

/**
 * イベントを更新する。
 *
 * @param id - イベント ID
 * @param input - 更新入力値
 * @returns 更新後イベント
 * @throws AdminServerNotFoundError 対象なし
 * @example
 * await updateEvent(3, { title: "新イベント" });
 */
export async function updateEvent(id: number, input: AdminEventUpdateInput): Promise<Event> {
  const client = getRequiredAdminClient();
  const payload = toEventUpdatePayload(input);
  const { data, error } = await client
    .from("events")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isNotFoundError(error)) {
      throw new AdminServerNotFoundError("更新対象のイベントが見つかりません。");
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new AdminServerNotFoundError("更新対象のイベントが見つかりません。");
  }
  return data as Event;
}

/**
 * イベントを削除する。
 *
 * @param id - イベント ID
 * @returns void
 * @throws AdminServerNotFoundError 対象なし
 * @example
 * await deleteEvent(3);
 */
export async function deleteEvent(id: number): Promise<void> {
  const client = getRequiredAdminClient();
  const { data, error } = await client
    .from("events")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isNotFoundError(error)) {
      throw new AdminServerNotFoundError("削除対象のイベントが見つかりません。");
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new AdminServerNotFoundError("削除対象のイベントが見つかりません。");
  }
}
