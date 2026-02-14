#!/usr/bin/env bun

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

type AssetItem = {
  localPath: string;
  storagePath: string;
  uploadPath: string;
  bytes: number;
  source: "legacy" | "public";
  variant: "full" | "thumb";
};

const ROOT = process.cwd();
const LEGACY_STATIC_DIR = join(ROOT, "legacy", "flask_app", "static");
const PUBLIC_DIR = join(ROOT, "public");
const MANIFEST_PATH = join(ROOT, "supabase", "storage-manifest.json");
const BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ??
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
  "iwate150data";
const DRY_RUN = !process.argv.includes("--run");
const ASCII_SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const TRANSIENT_ERROR_PATTERN =
  /(failed to parse json|unable to connect|fetch failed|network|timeout|temporarily|5\d\d|internal server error)/i;

/**
 * 対象バケットの存在を確認し、なければ作成を試みる（best effort）。
 *
 * ネットワーク制約などで確認APIが失敗する環境があるため、失敗時は警告のみ出して続行する。
 *
 * @param supabase - service_role で初期化した Supabase クライアント
 * @returns Promise<void>
 * @example
 * await ensureBucketBestEffort(supabase);
 */
async function ensureBucketBestEffort(supabase: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.warn(
      `[storage-migrate] warning: listBuckets failed (${listError.message}). assuming bucket exists and continuing.`
    );
    return;
  }
  const exists = (buckets ?? []).some((bucket) => bucket.name === BUCKET || bucket.id === BUCKET);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "1GB",
  });
  if (createError) {
    console.warn(
      `[storage-migrate] warning: createBucket failed (${createError.message}). continuing.`
    );
    return;
  }
  console.log(`[storage-migrate] created bucket=${BUCKET}`);
}

/**
 * ディレクトリ配下のファイルを再帰列挙する。
 *
 * @param dir - 走査対象ディレクトリ
 * @returns 絶対パス配列
 * @example
 * const files = await walkFiles("public/images");
 */
async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return walkFiles(fullPath);
      if (entry.isFile()) return [fullPath];
      return [] as string[];
    })
  );
  return files.flat();
}

/**
 * 画像拡張子を判定する。
 *
 * @param filePath - ファイルパス
 * @returns 画像なら true
 * @example
 * if (isImage(file)) { ... }
 */
function isImage(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext);
}

/**
 * 3Dモデル拡張子を判定する。
 *
 * @param filePath - ファイルパス
 * @returns モデルなら true
 * @example
 * if (isModel(file)) { ... }
 */
function isModel(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return [".obj", ".mtl", ".fbx", ".glb", ".gltf"].includes(ext);
}

/**
 * 拡張子から Content-Type を返す。
 *
 * @param filePath - ファイルパス
 * @returns MIME type
 * @example
 * const type = detectContentType("foo.obj");
 */
function detectContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const table: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".obj": "model/obj",
    ".mtl": "text/plain",
    ".fbx": "model/fbx",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
  };
  return table[ext] ?? "application/octet-stream";
}

/**
 * アップロード時に試す Content-Type 候補を返す。
 *
 * バケット側の許可 MIME 設定と合わない場合に備えて、`.fbx` は複数候補を試す。
 *
 * @param filePath - ファイルパス
 * @returns MIME 候補配列（undefined は contentType 指定なし）
 * @example
 * getContentTypeCandidates("foo.fbx");
 */
function getContentTypeCandidates(filePath: string): Array<string | undefined> {
  const ext = extname(filePath).toLowerCase();
  const primary = detectContentType(filePath);
  const candidates =
    ext === ".fbx"
      ? [primary, "application/octet-stream", "text/plain", undefined]
      : [primary, undefined];
  return [...new Set(candidates)];
}

/**
 * MIME 不一致時にフォールバックしながら Storage へアップロードする。
 *
 * @param supabase - Supabase クライアント
 * @param item - アップロード対象
 * @param data - バイナリ
 * @returns Promise<void>
 * @example
 * await uploadWithMimeFallback(supabase, item, data);
 */
async function uploadWithMimeFallback(
  supabase: SupabaseClient,
  item: AssetItem,
  data: Buffer
): Promise<void> {
  const candidates = getContentTypeCandidates(item.localPath);
  let lastError: { message: string } | null = null;
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let shouldRetryTransiently = false;

    for (let index = 0; index < candidates.length; index += 1) {
      const contentType = candidates[index];
      const options: { upsert: boolean; contentType?: string } = { upsert: true };
      if (contentType) options.contentType = contentType;

      const { error } = await supabase.storage.from(BUCKET).upload(item.uploadPath, data, options);
      if (!error) return;

      lastError = { message: error.message };

      // 一部環境ではアップロード成功後レスポンスJSON解釈に失敗することがあるため存在確認する
      if (/failed to parse json/i.test(error.message)) {
        const exists = await checkObjectExists(supabase, item.uploadPath);
        if (exists) {
          console.warn(
            `[storage-migrate] upload response parse error but object exists: ${item.uploadPath}`
          );
          return;
        }
      }

      const hasNext = index < candidates.length - 1;
      const isMimeError = /mime type .* is not supported/i.test(error.message);
      if (hasNext && isMimeError) {
        const nextLabel = candidates[index + 1] ?? "auto-detect";
        console.warn(
          `[storage-migrate] retrying with fallback MIME for ${item.uploadPath}: ${nextLabel}`
        );
        continue;
      }

      if (TRANSIENT_ERROR_PATTERN.test(error.message)) {
        shouldRetryTransiently = true;
      } else {
        throw new Error(
          `upload failed: ${item.uploadPath} (${lastError?.message ?? "unknown error"})`
        );
      }
      break;
    }

    if (shouldRetryTransiently && attempt < maxAttempts - 1) {
      const waitMs = (attempt + 1) * 1000;
      console.warn(
        `[storage-migrate] transient error retry ${attempt + 1}/${maxAttempts} for ${item.uploadPath}`
      );
      await sleep(waitMs);
      continue;
    }
    break;
  }

  if (lastError && /failed to parse json/i.test(lastError.message)) {
    const exists = await checkObjectExists(supabase, item.uploadPath);
    if (exists) {
      console.warn(
        `[storage-migrate] final parse error fallback accepted (object exists): ${item.uploadPath}`
      );
      return;
    }
  }

  throw new Error(`upload failed: ${item.uploadPath} (${lastError?.message ?? "unknown error"})`);
}

/**
 * 指定オブジェクトがバケット内に存在するか確認する。
 *
 * @param supabase - Supabase クライアント
 * @param objectPath - Storage object key
 * @returns 存在する場合 true
 * @example
 * const exists = await checkObjectExists(supabase, "images/spots/a.jpg");
 */
async function checkObjectExists(
  supabase: SupabaseClient,
  objectPath: string
): Promise<boolean> {
  const slash = objectPath.lastIndexOf("/");
  const prefix = slash === -1 ? "" : objectPath.slice(0, slash);
  const name = slash === -1 ? objectPath : objectPath.slice(slash + 1);
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 1000,
      search: name,
    });
    if (!error) return (data ?? []).some((entry) => entry.name === name);
    if (!TRANSIENT_ERROR_PATTERN.test(error.message) || attempt === maxAttempts - 1) return false;
    await sleep((attempt + 1) * 500);
  }
  return false;
}

/**
 * バケット内の既存オブジェクトを再帰的に取得する。
 *
 * @param supabase - Supabase クライアント
 * @param prefix - 走査プレフィックス
 * @returns object key 配列
 * @example
 * const keys = await listAllObjectPaths(supabase);
 */
async function listAllObjectPaths(supabase: SupabaseClient, prefix = ""): Promise<string[]> {
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
        const nested = await listAllObjectPaths(supabase, childPath);
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
 * Promise ベースの待機。
 *
 * @param ms - ミリ秒
 * @returns Promise<void>
 * @example
 * await sleep(1000);
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Storage オブジェクトキーを Supabase 互換の ASCII セーフ形式へ正規化する。
 *
 * @param storagePath - 元の Storage 相対パス
 * @returns ASCII セーフなアップロードキー
 * @example
 * toUploadKey("images/spots/かっこうだんご.jpg");
 */
function toUploadKey(storagePath: string): string {
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
 * legacy 配下の画像パスを現行 Storage パスへ変換する。
 *
 * @param imagePath - legacy 静的ディレクトリ配下の画像絶対パス
 * @returns Storage 相対パス
 * @example
 * mapLegacyImageToStoragePath("/.../city_images/Morioka_icon.jpg");
 */
function mapLegacyImageToStoragePath(imagePath: string): string {
  const rel = relative(join(LEGACY_STATIC_DIR, "images"), imagePath).replaceAll("\\", "/");
  if (rel.startsWith("city_images/")) return `images/cities/${basename(rel)}`;
  if (rel.startsWith("genre_images/")) return `images/genres/${basename(rel)}`;
  if (rel.startsWith("spot_images/")) return `images/spots/${basename(rel)}`;
  if (rel === "wanko.png") return "images/other/wanko.png";
  return `images/other/${basename(rel)}`;
}

/**
 * priority 付きで資産一覧をマージする。
 *
 * @param target - 出力マップ
 * @param item - 追加対象
 * @returns なし
 * @example
 * addItem(itemsByPath, item);
 */
function addItem(target: Map<string, AssetItem>, item: AssetItem): void {
  if (!target.has(item.storagePath)) {
    target.set(item.storagePath, item);
    return;
  }
  const current = target.get(item.storagePath);
  if (!current) {
    target.set(item.storagePath, item);
    return;
  }
  // legacy を優先し、同名があれば public をフォールバック扱いにする
  if (current.source === "public" && item.source === "legacy") {
    target.set(item.storagePath, item);
  }
}

/**
 * 元画像パスからサムネ配置先パスを生成する。
 *
 * @param storagePath - 元の storagePath
 * @returns サムネ用 storagePath。対象外なら null
 * @example
 * toThumbStoragePath("images/spots/foo.jpg");
 */
function toThumbStoragePath(storagePath: string): string | null {
  if (!storagePath.startsWith("images/")) return null;
  if (storagePath.startsWith("images/thumb/")) return null;
  return `images/thumb/${storagePath.slice("images/".length)}`;
}

/**
 * 画像資産を full + thumb(alias) として登録する。
 *
 * 現時点では元画像をそのまま thumb パスにも複製する。将来的に本物の縮小画像へ置換可能。
 *
 * @param target - 出力マップ
 * @param localPath - ローカルファイルパス
 * @param storagePath - 元 storagePath
 * @param bytes - ファイルサイズ
 * @param source - 資産ソース
 * @returns なし
 * @example
 * addImageWithThumbAlias(itemsByPath, path, "images/spots/foo.jpg", 1234, "legacy");
 */
function addImageWithThumbAlias(
  target: Map<string, AssetItem>,
  localPath: string,
  storagePath: string,
  bytes: number,
  source: "legacy" | "public"
): void {
  addItem(target, {
    localPath,
    storagePath,
    uploadPath: toUploadKey(storagePath),
    bytes,
    source,
    variant: "full",
  });

  const thumbPath = toThumbStoragePath(storagePath);
  if (!thumbPath) return;
  addItem(target, {
    localPath,
    storagePath: thumbPath,
    uploadPath: toUploadKey(thumbPath),
    bytes,
    source,
    variant: "thumb",
  });
}

/**
 * アップロード対象資産一覧を収集する。
 *
 * @returns 重複除去済み資産一覧
 * @example
 * const assets = await collectAssets();
 */
async function collectAssets(): Promise<AssetItem[]> {
  const itemsByPath = new Map<string, AssetItem>();

  if (existsSync(join(LEGACY_STATIC_DIR, "images"))) {
    const legacyImages = await walkFiles(join(LEGACY_STATIC_DIR, "images"));
    for (const filePath of legacyImages) {
      if (!isImage(filePath)) continue;
      const meta = await stat(filePath);
      const baseStoragePath = mapLegacyImageToStoragePath(filePath);
      addImageWithThumbAlias(itemsByPath, filePath, baseStoragePath, meta.size, "legacy");
    }
  }

  if (existsSync(join(LEGACY_STATIC_DIR, "models"))) {
    const legacyModels = await walkFiles(join(LEGACY_STATIC_DIR, "models"));
    for (const filePath of legacyModels) {
      if (!isModel(filePath)) continue;
      const rel = relative(join(LEGACY_STATIC_DIR, "models"), filePath).replaceAll("\\", "/");
      const meta = await stat(filePath);
      addItem(itemsByPath, {
        localPath: filePath,
        storagePath: `models/${rel}`,
        uploadPath: toUploadKey(`models/${rel}`),
        bytes: meta.size,
        source: "legacy",
        variant: "full",
      });
    }
  }

  if (existsSync(join(PUBLIC_DIR, "images"))) {
    const publicImages = await walkFiles(join(PUBLIC_DIR, "images"));
    for (const filePath of publicImages) {
      if (!isImage(filePath)) continue;
      const rel = relative(join(PUBLIC_DIR, "images"), filePath).replaceAll("\\", "/");
      const meta = await stat(filePath);
      addImageWithThumbAlias(itemsByPath, filePath, `images/${rel}`, meta.size, "public");
    }
  }

  if (existsSync(join(PUBLIC_DIR, "models"))) {
    const publicModels = await walkFiles(join(PUBLIC_DIR, "models"));
    for (const filePath of publicModels) {
      if (!isModel(filePath)) continue;
      const rel = relative(join(PUBLIC_DIR, "models"), filePath).replaceAll("\\", "/");
      const meta = await stat(filePath);
      addItem(itemsByPath, {
        localPath: filePath,
        storagePath: `models/${rel}`,
        uploadPath: toUploadKey(`models/${rel}`),
        bytes: meta.size,
        source: "public",
        variant: "full",
      });
    }
  }

  return [...itemsByPath.values()].sort((a, b) => a.storagePath.localeCompare(b.storagePath));
}

/**
 * 移行結果を manifest に保存する。
 *
 * @param assets - 資産一覧
 * @returns Promise<void>
 * @example
 * await writeManifest(assets);
 */
async function writeManifest(assets: AssetItem[]): Promise<void> {
  const payload = {
    generated_at: new Date().toISOString(),
    bucket: BUCKET,
    count: assets.length,
    items: assets,
  };
  await mkdir(join(ROOT, "supabase"), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

/**
 * メイン処理。
 *
 * @returns Promise<void>
 * @example
 * bun run scripts/migrate_storage_assets.ts --run
 */
async function main(): Promise<void> {
  const assets = await collectAssets();
  await writeManifest(assets);

  const totalBytes = assets.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`[storage-migrate] bucket=${BUCKET}`);
  console.log(`[storage-migrate] assets=${assets.length}, bytes=${totalBytes}`);
  console.log(`[storage-migrate] manifest=${relative(ROOT, MANIFEST_PATH)}`);

  if (DRY_RUN) {
    console.log("[storage-migrate] dry-run mode: upload is skipped");
    assets.slice(0, 20).forEach((item) => {
      const mapped =
        item.storagePath === item.uploadPath
          ? item.uploadPath
          : `${item.uploadPath} (from ${item.storagePath})`;
      console.log(
        `  - ${mapped} <- ${relative(ROOT, item.localPath)} (${item.source}/${item.variant})`
      );
    });
    if (assets.length > 20) {
      console.log(`  ... and ${assets.length - 20} more`);
    }
    console.log("[storage-migrate] run with --run to upload");
    return;
  }

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
  await ensureBucketBestEffort(supabase);

  let existingSet = new Set<string>();
  try {
    const existingObjects = await listAllObjectPaths(supabase);
    existingSet = new Set(existingObjects);
    console.log(`[storage-migrate] existing objects=${existingSet.size}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[storage-migrate] warning: failed to list existing objects (${message}). proceeding without skip cache.`
    );
  }

  let uploaded = 0;
  let skipped = 0;
  let processed = 0;
  for (const item of assets) {
    if (existingSet.has(item.uploadPath)) {
      skipped += 1;
      processed += 1;
      if (processed % 50 === 0 || processed === assets.length) {
        console.log(
          `[storage-migrate] processed ${processed}/${assets.length} (uploaded=${uploaded}, skipped=${skipped})`
        );
      }
      continue;
    }

    const data = await readFile(item.localPath);
    await uploadWithMimeFallback(supabase, item, data);
    uploaded += 1;
    processed += 1;
    existingSet.add(item.uploadPath);
    if (processed % 50 === 0 || processed === assets.length) {
      console.log(
        `[storage-migrate] processed ${processed}/${assets.length} (uploaded=${uploaded}, skipped=${skipped})`
      );
    }
  }

  console.log(`[storage-migrate] completed (uploaded=${uploaded}, skipped=${skipped})`);
}

main().catch((error) => {
  console.error("[storage-migrate] error:", error);
  process.exit(1);
});
