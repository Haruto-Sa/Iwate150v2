#!/usr/bin/env bun

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ??
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
  "iwate150data";
const ASCII_SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

type CityRow = {
  id: number;
  name: string;
  image_thumb_path: string | null;
  image_path: string | null;
};
type GenreRow = {
  id: number;
  name: string;
  image_thumb_path: string | null;
  image_path: string | null;
};
type SpotRow = {
  id: number;
  name: string;
  image_thumb_path: string | null;
  image_path: string | null;
  model_path: string | null;
};

type MissingRecord = {
  table: "cities" | "genres" | "spots" | "characters";
  id: string;
  field: string;
  path: string;
  pages: string;
};

/**
 * DB格納値を Storage 相対パスへ正規化する。
 *
 * @param rawPath - DB 文字列
 * @returns 正規化後の Storage 相対パス。対象外なら null
 * @example
 * normalizeStoragePath("/images/spots/foo.jpg");
 */
function normalizeStoragePath(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;

  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const markerIndex = rawPath.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(rawPath.slice(markerIndex + marker.length));
  }

  if (rawPath.startsWith("/images/") || rawPath.startsWith("/models/")) {
    return rawPath.slice(1);
  }
  if (rawPath.startsWith("images/") || rawPath.startsWith("models/")) {
    return rawPath;
  }
  return null;
}

/**
 * Storage オブジェクトキーを比較用に正規化する。
 *
 * DB が生パスでも、Storage 側がエンコード済みキーでも一致判定できるようにする。
 *
 * @param storagePath - Storage 相対パス
 * @returns 比較用キー（ASCII セーフ）
 * @example
 * canonicalizeStorageKey("images/spots/かっこうだんご.jpg");
 */
function canonicalizeStorageKey(storagePath: string): string {
  return storagePath
    .split("/")
    .filter(Boolean)
    .map((segment) => toAsciiSafeStorageSegment(decodeURIComponentSafe(segment)))
    .join("/");
}

/**
 * Storage キー用セグメントを ASCII セーフ表現へ変換する。
 *
 * @param segment - パスセグメント
 * @returns ASCII セーフなパスセグメント
 * @example
 * toAsciiSafeStorageSegment("かっこうだんご.jpg");
 */
function toAsciiSafeStorageSegment(segment: string): string {
  if (ASCII_SAFE_SEGMENT.test(segment)) return segment;
  const bytes = new TextEncoder().encode(segment);
  const hex = Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `u${hex}`;
}

/**
 * decodeURIComponent の安全版。
 *
 * @param value - 任意文字列
 * @returns decode 結果。失敗時は入力値を返す
 * @example
 * decodeURIComponentSafe("%E3%81%82");
 */
function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Storage バケット内の全オブジェクトを再帰的に収集する。
 *
 * @param supabase - Supabase クライアント
 * @param prefix - 走査開始パス
 * @returns オブジェクトパス配列
 * @example
 * const objects = await listAllStorageObjects(supabase, "images");
 */
async function listAllStorageObjects(
  supabase: SupabaseClient,
  prefix = ""
): Promise<string[]> {
  const objects: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`storage list failed (${prefix || "/"}) ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const childPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = !entry.metadata;
      if (isFolder) {
        const nested = await listAllStorageObjects(supabase, childPath);
        objects.push(...nested);
      } else {
        objects.push(childPath);
      }
    }

    if (data.length < 100) break;
    offset += 100;
  }
  return objects;
}

/**
 * characters.ts からモデル/サムネイルのパスを抽出する。
 *
 * @returns path 一覧
 * @example
 * const assets = await loadCharacterAssetPaths();
 */
async function loadCharacterAssetPaths(): Promise<
  Array<{ id: string; field: "model_path" | "mtl_path" | "thumbnail"; path: string }>
> {
  const source = await readFile(join(ROOT, "src", "lib", "characters.ts"), "utf-8");
  const records: Array<{ id: string; field: "model_path" | "mtl_path" | "thumbnail"; path: string }> =
    [];

  const blockRegex = /{\s*id:\s*"([^"]+)"[\s\S]*?}/g;
  for (const block of source.matchAll(blockRegex)) {
    const id = block[1];
    const body = block[0];
    for (const field of ["model_path", "mtl_path", "thumbnail"] as const) {
      const match = body.match(new RegExp(`${field}:\\s*"([^"]+)"`));
      if (!match) continue;
      records.push({ id, field, path: match[1] });
    }
  }
  return records;
}

/**
 * メイン検証処理。
 *
 * @returns Promise<void>
 * @example
 * bun run scripts/verify_storage_links.ts
 */
async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定して再実行してください。"
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [citiesRes, genresRes, spotsRes] = await Promise.all([
    supabase.from("cities").select("id,name,image_thumb_path,image_path"),
    supabase.from("genres").select("id,name,image_thumb_path,image_path"),
    supabase.from("spots").select("id,name,image_thumb_path,image_path,model_path"),
  ]);

  if (citiesRes.error) throw new Error(`cities query failed: ${citiesRes.error.message}`);
  if (genresRes.error) throw new Error(`genres query failed: ${genresRes.error.message}`);
  if (spotsRes.error) throw new Error(`spots query failed: ${spotsRes.error.message}`);

  const storageObjects = await listAllStorageObjects(supabase);
  const objectSet = new Set(storageObjects.map((obj) => canonicalizeStorageKey(obj)));
  const missing: MissingRecord[] = [];

  const cities = (citiesRes.data ?? []) as CityRow[];
  for (const row of cities) {
    const thumbNormalized = normalizeStoragePath(row.image_thumb_path);
    if (thumbNormalized) {
      const thumbCanonical = canonicalizeStorageKey(thumbNormalized);
      if (!objectSet.has(thumbCanonical)) {
        missing.push({
          table: "cities",
          id: String(row.id),
          field: "image_thumb_path",
          path: thumbCanonical,
          pages: "/, /search",
        });
      }
    }
    const normalized = normalizeStoragePath(row.image_path);
    if (!normalized) continue;
    const canonical = canonicalizeStorageKey(normalized);
    if (!objectSet.has(canonical)) {
      missing.push({
        table: "cities",
        id: String(row.id),
        field: "image_path",
        path: canonical,
        pages: "/, /search",
      });
    }
  }

  const genres = (genresRes.data ?? []) as GenreRow[];
  for (const row of genres) {
    const thumbNormalized = normalizeStoragePath(row.image_thumb_path);
    if (thumbNormalized) {
      const thumbCanonical = canonicalizeStorageKey(thumbNormalized);
      if (!objectSet.has(thumbCanonical)) {
        missing.push({
          table: "genres",
          id: String(row.id),
          field: "image_thumb_path",
          path: thumbCanonical,
          pages: "/search",
        });
      }
    }
    const normalized = normalizeStoragePath(row.image_path);
    if (!normalized) continue;
    const canonical = canonicalizeStorageKey(normalized);
    if (!objectSet.has(canonical)) {
      missing.push({
        table: "genres",
        id: String(row.id),
        field: "image_path",
        path: canonical,
        pages: "/search",
      });
    }
  }

  const spots = (spotsRes.data ?? []) as SpotRow[];
  for (const row of spots) {
    const thumbPath = normalizeStoragePath(row.image_thumb_path);
    if (thumbPath) {
      const thumbCanonical = canonicalizeStorageKey(thumbPath);
      if (!objectSet.has(thumbCanonical)) {
        missing.push({
          table: "spots",
          id: String(row.id),
          field: "image_thumb_path",
          path: thumbCanonical,
          pages: "/, /search, /spot",
        });
      }
    }
    const imagePath = normalizeStoragePath(row.image_path);
    if (imagePath) {
      const canonical = canonicalizeStorageKey(imagePath);
      if (!objectSet.has(canonical)) {
        missing.push({
          table: "spots",
          id: String(row.id),
          field: "image_path",
          path: canonical,
          pages: "/, /search, /spot",
        });
      }
    }
    const modelPath = normalizeStoragePath(row.model_path);
    if (modelPath) {
      const canonical = canonicalizeStorageKey(modelPath);
      if (!objectSet.has(canonical)) {
        missing.push({
          table: "spots",
          id: String(row.id),
          field: "model_path",
          path: canonical,
          pages: "/ar",
        });
      }
    }
  }

  const characterAssets = await loadCharacterAssetPaths();
  for (const asset of characterAssets) {
    const normalized = normalizeStoragePath(asset.path);
    if (!normalized) continue;
    const canonical = canonicalizeStorageKey(normalized);
    if (!objectSet.has(canonical)) {
      missing.push({
        table: "characters",
        id: asset.id,
        field: asset.field,
        path: canonical,
        pages: "/camera, /character",
      });
    }
  }

  console.log(`[storage-verify] bucket=${BUCKET}`);
  console.log(`[storage-verify] objects=${storageObjects.length}`);
  console.log(
    `[storage-verify] checked: cities=${cities.length}, genres=${genres.length}, spots=${spots.length}, characters=${characterAssets.length}`
  );

  if (missing.length === 0) {
    console.log("[storage-verify] OK: all referenced assets exist in Storage");
    return;
  }

  console.error(`[storage-verify] NG: missing assets=${missing.length}`);
  missing.slice(0, 50).forEach((item) => {
    console.error(
      `  - ${item.table}[${item.id}].${item.field}: ${item.path} (pages: ${item.pages})`
    );
  });
  if (missing.length > 50) {
    console.error(`  ... and ${missing.length - 50} more`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("[storage-verify] error:", error);
  process.exit(1);
});
