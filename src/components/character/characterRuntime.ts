import type * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ModelLoadError, ModelLoadSuccess } from "./characterModelLoader";

/**
 * 最新のモデル参照と回転状態を読みながら、既存順序で描画を開始する。
 * @param params - シーン、描画器、操作器、モデルと回転状態の参照
 * @returns 次の描画予約を取り消す終了処理
 * @example const stopAnimation = startViewerAnimation(params);
 */
export function startViewerAnimation({ scene, camera, renderer, controls, objectRef, rotatingRef }: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  objectRef: { current: THREE.Object3D | null };
  rotatingRef: { current: boolean };
}): () => void {
  let frame = 0;
  /** 描画を予約し、回転・操作器・描画を順に更新する。@returns なし @example animate(); */
  const animate = () => {
    frame = requestAnimationFrame(animate);
    if (rotatingRef.current && objectRef.current) objectRef.current.rotation.y += 0.01;
    controls.update();
    renderer.render(scene, camera);
  };
  animate();
  return () => cancelAnimationFrame(frame);
}

/**
 * 表示領域の変更を監視し、描画サイズの更新後にモデルを中央へ戻す。
 * @param params - 初期寸法、表示領域参照、描画器、カメラ、更新後の処理
 * @returns サイズ監視だけを停止する終了処理
 * @example const stopResize = observeViewerResize(params);
 */
export function observeViewerResize({ mount, mountRef, width, height, camera, renderer, characterId, onResize }: {
  mount: HTMLDivElement;
  mountRef: { current: HTMLDivElement | null };
  width: number;
  height: number;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  characterId?: string;
  onResize: () => void;
}): () => void {
  /** 現在の表示領域を読み、元の寸法フォールバックを適用する。@returns なし @example handleResize(); */
  const handleResize = () => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth || width;
    const h = mountRef.current.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    console.info("[CharacterViewer] viewport resized", { characterId, width: w, height: h });
    onResize();
  };
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mount);
  } else {
    window.addEventListener("resize", handleResize);
  }
  return () => {
    resizeObserver?.disconnect();
    if (!resizeObserver) window.removeEventListener("resize", handleResize);
  };
}

/**
 * 候補読込の失敗を従来の項目・接頭辞で記録する。
 * @param error - 候補ごとの失敗情報を持つ例外
 * @param characterId - 対象キャラクター
 * @returns なし
 * @example logViewerLoadFailure(error, characterId);
 */
export function logViewerLoadFailure(error: unknown, characterId?: string): void {
  const errorWithMeta = error as ModelLoadError;
  const failures = errorWithMeta.failures ?? [];
  console.warn("[CharacterViewer] all candidates failed", {
    characterId,
    message: errorWithMeta.message,
    failureCount: failures.length,
    failures: failures.map((failure) => ({
      stage: failure.stage,
      modelUrl: failure.modelUrl,
      mtlUrl: failure.mtlUrl,
      reason: failure.error instanceof Error ? failure.error.message : String(failure.error),
    })),
  });
}

/**
 * 読込成功を補正処理前の従来の項目・接頭辞で記録する。
 * @param payload - 成功候補の段階とURL
 * @param characterId - 対象キャラクター
 * @returns なし
 * @example logViewerModelLoaded(payload, characterId);
 */
export function logViewerModelLoaded({ stage, modelUrl, mtlUrl }: Pick<ModelLoadSuccess, "stage" | "modelUrl" | "mtlUrl">, characterId?: string): void {
  console.info("[CharacterViewer] candidate load succeeded", { characterId, stage, modelUrl, mtlUrl });
}
