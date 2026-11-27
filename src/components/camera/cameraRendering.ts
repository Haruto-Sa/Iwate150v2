import * as THREE from "three";
import { computeCoverCrop } from "./coverFit";

type SceneRefs = {
  overlayCanvasRef: { current: HTMLCanvasElement | null };
  sceneRef: { current: THREE.Scene | null };
  cameraRef: { current: THREE.PerspectiveCamera | null };
  rendererRef: { current: THREE.WebGLRenderer | null };
};

/**
 * 撮影用の透明シーンを一度だけ作り、従来の順序で参照へ設定する。
 * @param refs - 描画先とシーン・カメラ・描画器の参照
 * @returns なし
 * @example initializeCameraScene(refs);
 */
export function initializeCameraScene({ overlayCanvasRef, sceneRef, cameraRef, rendererRef }: SceneRefs): void {
  if (!overlayCanvasRef.current) return;
  if (sceneRef.current) return; // 既に初期化済みならスキップ

  const width = overlayCanvasRef.current.clientWidth || 640;
  const height = overlayCanvasRef.current.clientHeight || 480;

  const scene = new THREE.Scene();
  sceneRef.current = scene;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 5);
  cameraRef.current = camera;

  const renderer = new THREE.WebGLRenderer({
    canvas: overlayCanvasRef.current,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  rendererRef.current = renderer;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(2, 2, 2);
  scene.add(directionalLight);
}

/**
 * 現在のシーンと描画器を、元のcleanupと同じ順序で解放する。
 * @param refs - 解放時点のシーン・描画器の参照
 * @returns なし
 * @example disposeCameraScene({ sceneRef, rendererRef });
 */
export function disposeCameraScene({ sceneRef, rendererRef }: Pick<SceneRefs, "sceneRef" | "rendererRef">): void {
  sceneRef.current?.clear();
  rendererRef.current?.dispose();
  rendererRef.current?.forceContextLoss();
}

/**
 * 顔ランドマークを表示向きへ変換して、0〜1に収めた外接枠を返す。
 * @param lm - 検出済みの顔ランドマーク
 * @param isFront - 内カメラの鏡像表示か
 * @returns 表示基準の顔枠
 * @example const bounds = getCameraFaceBounds(landmarks, true);
 */
export function getCameraFaceBounds(lm: readonly { x: number; y: number }[], isFront: boolean): { x: number; y: number; width: number; height: number } {
  const xs = lm.map((p) => (isFront ? 1 - p.x : p.x));
  const ys = lm.map((p) => p.y);
  const minX = Math.max(0, Math.min(...xs));
  const maxX = Math.min(1, Math.max(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxY = Math.min(1, Math.max(...ys));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 表示と同じ切り抜き・鏡像で映像と最新の3D描画を出力canvasへ合成する。
 * @param params - 映像、出力先、寸法更新、向き、選択モデルの描画資源
 * @returns なし。映像や描画先が使えない場合は既存の例外を返す
 * @example drawCameraFrame({ ...resources, canvas, resize: true, mirrored: true, hasSelectedModels: false });
 */
export function drawCameraFrame({ video, canvas, resize, maxEdge, mirrored, hasSelectedModels, overlayCanvas, renderer, scene, camera }: {
  video: HTMLVideoElement | null;
  canvas: HTMLCanvasElement;
  resize: boolean;
  maxEdge?: number;
  mirrored: boolean;
  hasSelectedModels: boolean;
  overlayCanvas: HTMLCanvasElement | null;
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
}): void {
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error("Camera frame unavailable");
  const previewWidth = video.clientWidth || 720;
  const previewHeight = video.clientHeight || 480;
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const { sx, sy, sw, sh } = computeCoverCrop(
    sourceWidth, sourceHeight,
    resize ? previewWidth : canvas.width,
    resize ? previewHeight : canvas.height,
  );

  if (resize) {
    const scale = maxEdge ? Math.min(1, maxEdge / Math.max(sw, sh)) : 1;
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  if (mirrored) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  if (hasSelectedModels && overlayCanvas && renderer && scene && camera) {
    // 最新フレームを描画してから重ねる
    renderer.render(scene, camera);
    ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
  }
}
