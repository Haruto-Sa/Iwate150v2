import * as THREE from "three";
import { extractFileStem, resolveModelFormat } from "@/lib/modelAssets";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export type ModelLoadAttemptFailure = {
  modelUrl: string;
  mtlUrl: string | null;
  stage: "mtl+obj" | "obj" | "fbx";
  error: unknown;
};

export type ModelLoadSuccess = {
  object: THREE.Group;
  modelUrl: string;
  mtlUrl: string | null;
  stage: "mtl+obj" | "obj" | "fbx";
};

export type ModelLoadError = Error & {
  failures?: ModelLoadAttemptFailure[];
};

/** ローカル配信モデルの読み込みタイムアウト（ミリ秒） */
const LOCAL_LOAD_TIMEOUT_MS = 45_000;
/** リモート配信モデルの読み込みタイムアウト（ミリ秒） */
const REMOTE_LOAD_TIMEOUT_MS = 12_000;

/**
 * Promise にタイムアウトを設定する。
 *
 * @param promise - 元の Promise
 * @param ms - タイムアウト（ミリ秒）
 * @param label - エラーメッセージ用ラベル
 * @returns タイムアウト付き Promise
 * @example
 * const result = await withTimeout(fetch(url), 10000, "fetch");
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout (${ms}ms): ${label}`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * 候補URLがローカル配信かどうかを推定する。
 *
 * @param url - モデル/MTL URL
 * @returns ローカル配信なら true
 * @example
 * const local = isLikelyLocalAssetUrl("/models/wanko1.obj");
 */
function isLikelyLocalAssetUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    if (typeof window === "undefined") return false;
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * 候補URLに応じた読み込みタイムアウト値を返す。
 *
 * @param url - モデル/MTL URL
 * @returns タイムアウト（ミリ秒）
 * @example
 * const timeout = getLoadTimeoutMs("/models/wanko1.obj");
 */
function getLoadTimeoutMs(url: string): number {
  return isLikelyLocalAssetUrl(url) ? LOCAL_LOAD_TIMEOUT_MS : REMOTE_LOAD_TIMEOUT_MS;
}

/**
 * 失敗時に一定回数まで再試行する。
 *
 * @param task - 実行する非同期処理
 * @param retryCount - リトライ回数（初回実行を除く）
 * @returns 実行結果
 * @example
 * const value = await withRetries(() => fetcher(), 2);
 */
async function withRetries<T>(
  task: () => Promise<T>,
  retryCount: number,
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= retryCount) break;
    }
  }
  throw lastError;
}

/**
 * MTL ファイルをロードする。
 *
 * @param url - MTL URL
 * @param timeoutMs - タイムアウト（ミリ秒）
 * @returns material creator
 * @example
 * const materials = await loadMtlMaterials("/models/a.mtl", 30000);
 */
function loadMtlMaterials(
  url: string,
  timeoutMs: number,
): Promise<MTLLoader.MaterialCreator> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const loader = new MTLLoader();
      loader.load(url, resolve, undefined, reject);
    }),
    timeoutMs,
    `MTL ${url}`,
  );
}

/**
 * OBJ ファイルをロードする。
 *
 * @param modelUrl - OBJ URL
 * @param timeoutMs - タイムアウト（ミリ秒）
 * @param materials - 事前ロード済み MTL
 * @returns OBJ group
 * @example
 * const obj = await loadObjModel("/models/a.obj", 30000, materials);
 */
function loadObjModel(
  modelUrl: string,
  timeoutMs: number,
  materials?: MTLLoader.MaterialCreator
): Promise<THREE.Group> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const loader = new OBJLoader();
      if (materials) {
        materials.preload();
        loader.setMaterials(materials);
      }
      loader.load(modelUrl, resolve, undefined, reject);
    }),
    timeoutMs,
    `OBJ ${modelUrl}`,
  );
}

/**
 * FBX ファイルをロードする。
 *
 * @param modelUrl - FBX URL
 * @param timeoutMs - タイムアウト（ミリ秒）
 * @returns FBX group
 * @example
 * const object = await loadFbxModel("/models/character.fbx", 45000);
 */
function loadFbxModel(modelUrl: string, timeoutMs: number): Promise<THREE.Group> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(modelUrl, resolve, undefined, reject);
    }),
    timeoutMs,
    `FBX ${modelUrl}`,
  );
}

/**
 * モデル候補を順に試行して最初に読める組み合わせを返す。
 *
 * @param modelCandidates - モデル候補
 * @param mtlCandidates - MTL候補
 * @param retryCount - 候補ごとのリトライ回数
 * @returns 読み込み済みオブジェクト
 * @example
 * const object = await loadModelFromCandidates(models, mtls, 2);
 */
export async function loadModelFromCandidates(
  modelCandidates: string[],
  mtlCandidates: string[],
  retryCount: number,
): Promise<ModelLoadSuccess> {
  let lastError: unknown = null;
  const failures: ModelLoadAttemptFailure[] = [];

  for (const modelUrl of modelCandidates) {
    const modelFormat = resolveModelFormat(modelUrl);
    const modelTimeout = getLoadTimeoutMs(modelUrl);

    if (modelFormat === "fbx") {
      try {
        const object = await withRetries(
          () => loadFbxModel(modelUrl, modelTimeout),
          retryCount,
        );
        return { object, modelUrl, mtlUrl: null, stage: "fbx" };
      } catch (error) {
        lastError = error;
        failures.push({ modelUrl, mtlUrl: null, stage: "fbx", error });
        console.warn("[CharacterViewer] candidate failed", { stage: "fbx", modelUrl, error });
      }
      continue;
    }

    const modelStem = extractFileStem(modelUrl);
    const matchedMtlCandidates =
      modelStem === null
        ? []
        : mtlCandidates.filter((mtlUrl) => extractFileStem(mtlUrl) === modelStem);
    if (matchedMtlCandidates.length > 0) {
      for (const mtlUrl of matchedMtlCandidates) {
        const timeoutMs = Math.max(modelTimeout, getLoadTimeoutMs(mtlUrl));
        try {
          const object = await withRetries(async () => {
            const materials = await loadMtlMaterials(mtlUrl, timeoutMs);
            return await loadObjModel(modelUrl, timeoutMs, materials);
          }, retryCount);
          return { object, modelUrl, mtlUrl, stage: "mtl+obj" };
        } catch (error) {
          lastError = error;
          failures.push({ modelUrl, mtlUrl, stage: "mtl+obj", error });
          console.warn("[CharacterViewer] candidate failed", { stage: "mtl+obj", modelUrl, mtlUrl, error });
        }
      }
    }

    try {
      const object = await withRetries(
        () => loadObjModel(modelUrl, modelTimeout),
        retryCount,
      );
      return { object, modelUrl, mtlUrl: null, stage: "obj" };
    } catch (error) {
      lastError = error;
      failures.push({ modelUrl, mtlUrl: null, stage: "obj", error });
      console.warn("[CharacterViewer] candidate failed", { stage: "obj", modelUrl, error });
    }
  }

  const modelError = new Error("No valid model candidate") as ModelLoadError;
  modelError.cause = lastError ?? undefined;
  modelError.failures = failures;
  throw modelError;
}

