import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { measureCameraWork } from "./cameraTimings";

export const CAMERA_MODEL_TIMEOUT_MS = 20_000;
const MAX_ASSET_BYTES = 32 * 1024 * 1024;

/**
 * モデルの中心補正を追従用transformから分離し、最長辺を1に正規化する。
 * @param object - 読み込んだカメラ専用モデル
 * @returns 位置・拡大率を変更しても原点の補正を保持する親グループ
 * @example scene.add(normalizeCameraModel(object));
 */
export function normalizeCameraModel(object: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = 1 / (Math.max(size.x, size.y, size.z) || 1);
  const centered = new THREE.Group();
  centered.add(object);
  centered.position.copy(box.getCenter(new THREE.Vector3())).negate();
  const model = new THREE.Group();
  model.add(centered);
  model.scale.setScalar(scale);
  model.userData.normalizeScale = scale;
  return model;
}

/**
 * カメラ専用モデルのgeometry/material/textureを重複なく解放する。
 * @param object - この画面が所有するモデル
 * @returns なし
 * @example disposeCameraModel(model);
 */
export function disposeCameraModel(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    if ((child as THREE.SkinnedMesh).skeleton) skeletons.add((child as THREE.SkinnedMesh).skeleton);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
  }
  for (const texture of textures) {
    texture.dispose();
    if (typeof HTMLImageElement !== "undefined" && texture.image instanceof HTMLImageElement) texture.image.src = "";
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
  object.removeFromParent();
}

/**
 * 受信中にもサイズを確認し、期限・中止を共有する。
 * @param url - アセットURL
 * @param signal - 読み込み全体の中止通知
 * @returns 最大32MiBのデータ
 * @example const data = await readAsset(url, signal);
 */
async function readAsset(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  let response = await fetch(url, { signal });
  for (let retry = 0; response.status >= 500 && retry < 2; retry += 1) {
    await response.body?.cancel();
    signal.throwIfAborted();
    response = await fetch(url, { signal });
  }
  if (!response.ok) throw new Error(`Asset request failed (${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Asset response has no body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ASSET_BYTES) throw new Error("Asset exceeds 32MiB limit");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return buffer.buffer;
}

/**
 * 取得済み画像をデコードし、中止時に画像と一時URLを破棄する。
 * @param data - 画像データ
 * @param signal - 読み込み全体の中止通知
 * @returns 読み込み済み画像
 * @example const image = await decodeTexture(data, signal);
 */
function decodeTexture(data: ArrayBuffer, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([data]));
    /** 監視と一時URLを解放する。@returns なし @example cleanup(); */
    const cleanup = () => {
      signal.removeEventListener("abort", cancel);
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
    /** デコードを中止する。@returns なし @example cancel(); */
    const cancel = () => { cleanup(); image.src = ""; reject(signal.reason); };
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error("Texture decode failed")); };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    else image.src = url;
  });
}

/**
 * OBJ/MTLを並行取得し、FBXを含め画像の準備まで待つ。中止時は返却しない。
 * @param id - 計測用カタログID
 * @param modelUrl - OBJまたはFBX
 * @param mtlUrl - OBJの任意のマテリアルURL
 * @param signal - 選択解除・離脱の中止通知
 * @returns この画面が所有するモデル。使用後はdisposeCameraModelを呼ぶ
 * @example const object = await loadCameraModel(id, url, mtl, controller.signal);
 */
export async function loadCameraModel(id: string, modelUrl: string, mtlUrl: string | null, signal: AbortSignal): Promise<THREE.Object3D> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const deadline = setTimeout(() => controller.abort(new DOMException("Model load timed out", "TimeoutError")), CAMERA_MODEL_TIMEOUT_MS);
  let object: THREE.Object3D | undefined;
  let returned = false;
  let released = false;
  /** 失敗した所有物を一度だけ解放する。@returns なし @example release(); */
  const release = () => {
    if (object && !released) { disposeCameraModel(object); released = true; }
  };
  const blobUrls = new Set<string>();
  let texturesStarted = false;
  let textureError = false;
  let finishTextures: () => void = () => undefined;
  const texturesReady = new Promise<void>((resolve) => { finishTextures = resolve; });
  const manager = new THREE.LoadingManager();
  manager.onStart = () => { texturesStarted = true; };
  manager.onError = () => { textureError = true; };
  manager.onLoad = () => {
    if (controller.signal.aborted && !returned) release();
    finishTextures();
  };
  manager.setURLModifier((url) => { if (url.startsWith("blob:")) blobUrls.add(url); return url; });
  // MTLの外部画像も同じAbortSignal・サイズ上限で所有する。
  const textureLoader = new THREE.TextureLoader(manager);
  textureLoader.load = (url, onLoad, _onProgress, onError) => {
    const texture = new THREE.Texture();
    manager.itemStart(url);
    void readAsset(url, controller.signal).then((data) => decodeTexture(data, controller.signal)).then((image) => {
      controller.signal.throwIfAborted();
      texture.image = image;
      texture.needsUpdate = true;
      onLoad?.(texture);
    }).catch((error) => {
      manager.itemError(url);
      onError?.(error);
    }).finally(() => manager.itemEnd(url));
    return texture;
  };
  manager.addHandler(/.*/, textureLoader);
  let rejectCancelled: () => void = () => undefined;
  const cancelled = new Promise<never>((_, reject) => {
    rejectCancelled = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectCancelled, { once: true });
  });
  // 初期キャンセルでも未処理のrejectを発生させず、以下のraceから返す。
  void cancelled.catch(() => undefined);
  try {
    controller.signal.throwIfAborted();
    const isFbx = modelUrl.split(/[?#]/)[0].toLowerCase().endsWith(".fbx");
    const [data, materialData] = await Promise.race([Promise.all([
      readAsset(modelUrl, controller.signal),
      !isFbx && mtlUrl ? readAsset(mtlUrl, controller.signal).catch(() => {
        controller.signal.throwIfAborted();
        // 従来と同様、MTLだけが取得できない場合はOBJの既定材質を使う。
        return null;
      }) : Promise.resolve(null),
    ]), cancelled]);
    controller.signal.throwIfAborted();
    if (isFbx) {
      object = measureCameraWork(`${id}:parse`, () => new FBXLoader(manager).parse(data, THREE.LoaderUtils.extractUrlBase(modelUrl)));
    } else {
      const loader = new OBJLoader(manager);
      if (materialData && mtlUrl) {
        const materials = measureCameraWork(`${id}:material-parse`, () => new MTLLoader(manager).parse(new TextDecoder().decode(materialData), THREE.LoaderUtils.extractUrlBase(mtlUrl)));
        materials.preload();
        loader.setMaterials(materials);
      }
      object = measureCameraWork(`${id}:parse`, () => loader.parse(new TextDecoder().decode(data)));
    }
    if (texturesStarted) await Promise.race([texturesReady, cancelled]);
    controller.signal.throwIfAborted();
    if (textureError) throw new Error("Model texture failed to load");
    returned = true;
    return object;
  } catch (error) {
    release();
    throw error;
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", rejectCancelled);
    // Promise.allの他方が残っていても通信を残さない。
    controller.abort();
    for (const url of blobUrls) URL.revokeObjectURL(url);
  }
}
