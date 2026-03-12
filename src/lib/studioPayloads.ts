import type {
  AdminEventCreateInput,
  AdminEventUpdateInput,
  AdminSpotCreateInput,
  AdminSpotUpdateInput,
} from "@/lib/types";
import {
  parseOptionalDate,
  parseOptionalInteger,
  parseOptionalString,
  parseRequiredInteger,
  parseRequiredNumber,
  parseRequiredString,
} from "@/lib/studioApi";

/**
 * スポット作成入力を検証する。
 *
 * @param input - 生入力
 * @returns 正規化済み入力
 * @example
 * parseSpotCreateInput(await request.json());
 */
export function parseSpotCreateInput(input: Record<string, unknown>): AdminSpotCreateInput {
  return {
    name: parseRequiredString(input.name, "name"),
    description: parseRequiredString(input.description, "description"),
    city_id: parseRequiredInteger(input.city_id, "city_id"),
    genre_id: parseRequiredInteger(input.genre_id, "genre_id"),
    lat: parseRequiredNumber(input.lat, "lat"),
    lng: parseRequiredNumber(input.lng, "lng"),
    image_thumb_path: parseOptionalString(input.image_thumb_path),
    image_path: parseOptionalString(input.image_path),
    model_path: parseOptionalString(input.model_path),
    reference_url: parseOptionalString(input.reference_url),
  };
}

/**
 * スポット更新入力を検証する。
 *
 * @param input - 生入力
 * @returns 正規化済み入力
 * @throws Error 更新項目なし
 * @example
 * parseSpotUpdateInput(await request.json());
 */
export function parseSpotUpdateInput(input: Record<string, unknown>): AdminSpotUpdateInput {
  const payload: AdminSpotUpdateInput = {};

  if ("name" in input) payload.name = parseRequiredString(input.name, "name");
  if ("description" in input) payload.description = parseRequiredString(input.description, "description");
  if ("city_id" in input) payload.city_id = parseRequiredInteger(input.city_id, "city_id");
  if ("genre_id" in input) payload.genre_id = parseRequiredInteger(input.genre_id, "genre_id");
  if ("lat" in input) payload.lat = parseRequiredNumber(input.lat, "lat");
  if ("lng" in input) payload.lng = parseRequiredNumber(input.lng, "lng");
  if ("image_thumb_path" in input) payload.image_thumb_path = parseOptionalString(input.image_thumb_path);
  if ("image_path" in input) payload.image_path = parseOptionalString(input.image_path);
  if ("model_path" in input) payload.model_path = parseOptionalString(input.model_path);
  if ("reference_url" in input) payload.reference_url = parseOptionalString(input.reference_url);

  if (Object.keys(payload).length === 0) {
    throw new Error("At least one field is required for update.");
  }
  return payload;
}

/**
 * イベント作成入力を検証する。
 *
 * @param input - 生入力
 * @returns 正規化済み入力
 * @example
 * parseEventCreateInput(await request.json());
 */
export function parseEventCreateInput(input: Record<string, unknown>): AdminEventCreateInput {
  const startDate = parseOptionalDate(input.start_date, "start_date");
  const endDate = parseOptionalDate(input.end_date, "end_date");
  assertEventDateOrder(startDate, endDate);

  return {
    title: parseRequiredString(input.title, "title"),
    location: parseOptionalString(input.location),
    start_date: startDate,
    end_date: endDate,
    city_id: parseOptionalInteger(input.city_id, "city_id"),
  };
}

/**
 * イベント更新入力を検証する。
 *
 * @param input - 生入力
 * @param current - 既存イベント値
 * @returns 正規化済み入力
 * @throws Error 更新項目なしまたは日付不整合
 * @example
 * parseEventUpdateInput(await request.json(), currentEvent);
 */
export function parseEventUpdateInput(
  input: Record<string, unknown>,
  current: { start_date?: string | null; end_date?: string | null }
): AdminEventUpdateInput {
  const payload: AdminEventUpdateInput = {};

  if ("title" in input) payload.title = parseRequiredString(input.title, "title");
  if ("location" in input) payload.location = parseOptionalString(input.location);
  if ("city_id" in input) payload.city_id = parseOptionalInteger(input.city_id, "city_id");
  if ("start_date" in input) payload.start_date = parseOptionalDate(input.start_date, "start_date");
  if ("end_date" in input) payload.end_date = parseOptionalDate(input.end_date, "end_date");

  if (Object.keys(payload).length === 0) {
    throw new Error("At least one field is required for update.");
  }

  assertEventDateOrder(payload.start_date ?? current.start_date ?? null, payload.end_date ?? current.end_date ?? null);
  return payload;
}

/**
 * イベント日付の前後関係を検証する。
 *
 * @param startDate - 開始日
 * @param endDate - 終了日
 * @returns void
 * @throws Error 終了日が開始日より前
 * @example
 * assertEventDateOrder("2026-03-12", "2026-03-13");
 */
function assertEventDateOrder(startDate: string | null, endDate: string | null): void {
  if (startDate && endDate && endDate < startDate) {
    throw new Error("end_date must be on or after start_date.");
  }
}

