import { createCameraFaceWorker, type CameraFaceTracker, type CameraFaceResults } from "@/lib/cameraFaceWorker";
import { markCameraTiming } from "@/lib/cameraTimings";

export type FaceMeshInstance = CameraFaceTracker;
export type FaceMeshResults = CameraFaceResults;
export type FaceResultsHandler = (results: FaceMeshResults) => void;
type FaceMeshConstructor = typeof import("@mediapipe/face_mesh").FaceMesh;

const MEDIAPIPE_FACE_MESH_ASSET_BASE =
  process.env.NEXT_PUBLIC_MEDIAPIPE_FACE_MESH_ASSET_BASE ?? "/mediapipe/face_mesh";

/**
 * MediaPipe の locateFile で利用するアセットURLを組み立てる。
 *
 * SIMD 版で不安定になる環境向けに non-SIMD バイナリへ寄せる。
 *
 * @param file - MediaPipe から要求されるファイル名
 * @returns 配信先 URL
 * @example
 * const url = resolveFaceMeshAssetUrl("face_mesh_solution_simd_wasm_bin.js");
 */
function resolveFaceMeshAssetUrl(file: string): string {
  const normalizedFile = file
    .replace("face_mesh_solution_simd_wasm_bin.js", "face_mesh_solution_wasm_bin.js")
    .replace("face_mesh_solution_simd_wasm_bin.wasm", "face_mesh_solution_wasm_bin.wasm");
  return `${MEDIAPIPE_FACE_MESH_ASSET_BASE}/${normalizedFile}`;
}

/**
 * MediaPipe Solutions のグローバル関数を初期化前にリセットする。
 *
 * HMR や再初期化時に古いインスタンス状態が残るのを防ぐ。
 *
 * @returns なし
 * @example
 * resetMediaPipeSolutionGlobals();
 */
function resetMediaPipeSolutionGlobals(): void {
  const globalScope = globalThis as typeof globalThis & Record<string, unknown>;
  globalScope.createMediapipeSolutionsWasm = undefined;
  globalScope.createMediapipeSolutionsPackedAssets = undefined;
}

/**
 * MediaPipe モジュールから実体の export を解決する。
 *
 * bundler によって named export が `default` や `module.exports` 配下へ
 * ぶら下がるため、その差を吸収する。
 *
 * @param moduleNamespace - dynamic import の戻り値
 * @param exportName - 取り出したい export 名
 * @returns 見つかった export。未検出時は null
 * @example
 * const FaceMeshCtor = resolveMediaPipeExport(moduleNamespace, "FaceMesh");
 */
function resolveMediaPipeExport<T>(
  moduleNamespace: unknown,
  exportName: string
): T | null {
  if (!moduleNamespace || (typeof moduleNamespace !== "object" && typeof moduleNamespace !== "function")) {
    return readMediaPipeGlobalExport<T>(exportName);
  }

  const namespaceRecord = moduleNamespace as Record<string, unknown>;
  const direct = namespaceRecord[exportName];
  if (direct) return direct as T;

  const defaultNamespace = namespaceRecord.default;
  if (defaultNamespace && (typeof defaultNamespace === "object" || typeof defaultNamespace === "function")) {
    const defaultRecord = defaultNamespace as Record<string, unknown>;
    const defaultExport = defaultRecord[exportName];
    if (defaultExport) return defaultExport as T;
    if (typeof defaultNamespace === "function" && defaultNamespace.name === exportName) {
      return defaultNamespace as T;
    }
  }

  const commonJsNamespace = namespaceRecord["module.exports"];
  if (commonJsNamespace && (typeof commonJsNamespace === "object" || typeof commonJsNamespace === "function")) {
    const commonJsRecord = commonJsNamespace as Record<string, unknown>;
    const commonJsExport = commonJsRecord[exportName];
    if (commonJsExport) return commonJsExport as T;
    if (typeof commonJsNamespace === "function" && commonJsNamespace.name === exportName) {
      return commonJsNamespace as T;
    }
  }

  return readMediaPipeGlobalExport<T>(exportName);
}

/**
 * MediaPipe が global へ公開した constructor を読む。
 *
 * 一部の UMD ビルドは import namespace へ export を返さず、
 * 副作用で `window.FaceMesh` / `window.Camera` を生やすだけなので、
 * 最後のフォールバックとして global を参照する。
 *
 * @param exportName - 取り出したい export 名
 * @returns 見つかった export。未検出時は null
 * @example
 * const CameraCtor = readMediaPipeGlobalExport("Camera");
 */
function readMediaPipeGlobalExport<T>(exportName: string): T | null {
  const globalScope = globalThis as typeof globalThis & Record<string, unknown>;
  const globalExport = globalScope[exportName];
  return globalExport ? (globalExport as T) : null;
}

let sharedFaceMesh: FaceMeshInstance | null = null;
let sharedFaceMeshPromise: Promise<FaceMeshInstance> | null = null;

/**
 * `Module.arguments` 系の Emscripten RuntimeError か判定する。
 *
 * @param error - 捕捉した例外
 * @returns 対象エラーなら true
 * @example
 * if (isFaceMeshModuleArgumentsError(error)) { ... }
 */
export function isFaceMeshModuleArgumentsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /module\.arguments/i.test(message);
}

/**
 * FaceMesh インスタンスを新規生成する。
 *
 * @returns 初期化済み FaceMesh
 * @example
 * const faceMesh = await createFaceMeshInstance();
 */
async function createFaceMeshInstance(): Promise<FaceMeshInstance> {
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined") {
    try {
      return await createCameraFaceWorker(MEDIAPIPE_FACE_MESH_ASSET_BASE);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotSupportedError")) throw error;
      markCameraTiming("face:worker-unavailable");
    }
  }
  markCameraTiming("face:import:start");
  resetMediaPipeSolutionGlobals();
  const moduleNamespace = await import("@mediapipe/face_mesh");
  markCameraTiming("face:import:end");
  const FaceMesh = resolveMediaPipeExport<FaceMeshConstructor>(moduleNamespace, "FaceMesh");
  if (!FaceMesh) {
    throw new Error("FaceMesh constructor is unavailable in @mediapipe/face_mesh");
  }
  const faceMesh = new FaceMesh({
    locateFile: (file) => resolveFaceMeshAssetUrl(file),
  });
  if (typeof faceMesh.initialize === "function") {
    markCameraTiming("face:initialize:start");
    await faceMesh.initialize();
    markCameraTiming("face:initialize:end");
  }
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return faceMesh;
}

/**
 * 共有 FaceMesh インスタンスを取得する（single-flight）。
 *
 * @returns FaceMesh インスタンス
 * @example
 * const faceMesh = await acquireFaceMeshInstance();
 */
export async function acquireFaceMeshInstance(): Promise<FaceMeshInstance> {
  if (sharedFaceMesh) return sharedFaceMesh;
  if (!sharedFaceMeshPromise) {
    sharedFaceMeshPromise = createFaceMeshInstance()
      .then((instance) => {
        sharedFaceMesh = instance;
        return instance;
      })
      .catch((error) => {
        sharedFaceMeshPromise = null;
        throw error;
      });
  }
  return sharedFaceMeshPromise;
}

/**
 * 共有 FaceMesh を破棄して再生成する。
 *
 * @returns 再生成済み FaceMesh
 * @example
 * const recovered = await recreateFaceMeshInstance();
 */
export async function recreateFaceMeshInstance(): Promise<FaceMeshInstance> {
  if (sharedFaceMesh && typeof sharedFaceMesh.close === "function") {
    sharedFaceMesh.close();
  }
  sharedFaceMesh = null;
  sharedFaceMeshPromise = null;
  return acquireFaceMeshInstance();
}

/**
 * 失敗したインスタンスが共有対象なら参照と初期化Promiseを破棄する。
 * closeと画面側の状態更新は呼び出し側で行う。
 * @param instance - 失敗した画面側のインスタンス
 * @returns なし
 * @example forgetFailedFaceMeshInstance(faceMeshRef.current);
 */
export function forgetFailedFaceMeshInstance(instance: FaceMeshInstance | null): void {
  if (sharedFaceMesh === instance) {
    sharedFaceMesh = null;
    sharedFaceMeshPromise = null;
  }
}
