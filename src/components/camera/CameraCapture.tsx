"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Camera as CameraIcon, RefreshCw, Check, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { characterModelCatalog, characters } from "@/lib/characters";
import { getModelUrl } from "@/lib/storage";
import { resolveClientStorageUrl } from "@/lib/storageSignedClient";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

type Detection = { x: number; y: number; width: number; height: number } | null;

type FaceMeshInstance = import("@mediapipe/face_mesh").FaceMesh;
type FaceMeshResults = import("@mediapipe/face_mesh").Results;
type MediaPipeCamera = import("@mediapipe/camera_utils").Camera;
type FaceResultsHandler = (results: FaceMeshResults) => void;
type ModelFormat = "obj" | "fbx";
type ModelLoadStatus = "idle" | "loading" | "ready" | "error";
type ModelSource = { modelUrl: string; mtlUrl: string | null };

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
 * モデルURLから読み込みフォーマットを判定する。
 *
 * @param modelPath - モデルパス
 * @returns `obj` または `fbx`
 * @example
 * const format = resolveModelFormat("/models/goshodon.obj");
 */
function resolveModelFormat(modelPath: string): ModelFormat {
  const stripped = modelPath.split("?")[0]?.split("#")[0] ?? modelPath;
  return stripped.toLowerCase().endsWith(".fbx") ? "fbx" : "obj";
}

/**
 * Storage相対パスからローカルpublic参照URLを作成する。
 *
 * @param path - `models/...` 形式のパス
 * @returns `/models/...` 形式のURL
 * @example
 * const local = toLocalAssetUrl("models/goshodon.obj");
 */
function toLocalAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * キャラクターIDから表示名を解決する。
 *
 * @param id - キャラクターID
 * @returns 表示名
 * @example
 * const name = getCharacterNameById("goshodon");
 */
function getCharacterNameById(id: string): string {
  return characters.find((character) => character.id === id)?.name ?? id;
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
function isFaceMeshModuleArgumentsError(error: unknown): boolean {
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
  resetMediaPipeSolutionGlobals();
  const { FaceMesh } = await import("@mediapipe/face_mesh");
  const faceMesh = new FaceMesh({
    locateFile: (file) => resolveFaceMeshAssetUrl(file),
  });
  if (typeof faceMesh.initialize === "function") {
    await faceMesh.initialize();
  }
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
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
async function acquireFaceMeshInstance(): Promise<FaceMeshInstance> {
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
async function recreateFaceMeshInstance(): Promise<FaceMeshInstance> {
  if (sharedFaceMesh && typeof sharedFaceMesh.close === "function") {
    sharedFaceMesh.close();
  }
  sharedFaceMesh = null;
  sharedFaceMeshPromise = null;
  return acquireFaceMeshInstance();
}

export function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const faceMeshRef = useRef<FaceMeshInstance | null>(null);
  const mediaPipeCameraRef = useRef<MediaPipeCamera | null>(null);
  const modelMapRef = useRef<Record<string, THREE.Object3D>>({});
  const modelSourceMapRef = useRef<Record<string, ModelSource>>({});
  const detectionRef = useRef<Detection>(null);
  const loadingSetRef = useRef<Set<string>>(new Set());
  const lastDetStateUpdateRef = useRef(0);
  const startInProgressRef = useRef(false);
  const unmountedRef = useRef(false);
  const recoveringFaceMeshRef = useRef(false);
  const faceResultHandlerRef = useRef<FaceResultsHandler>(() => undefined);

  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [detection, setDetection] = useState<Detection>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "denied">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelStatusMap, setModelStatusMap] = useState<Record<string, ModelLoadStatus>>({});
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const facingModeRef = useRef<"user" | "environment">("user");
  const router = useRouter();

  const selectedModelsReady = useMemo(
    () => selectedModels.length > 0 && selectedModels.every((id) => modelStatusMap[id] === "ready"),
    [modelStatusMap, selectedModels]
  );
  const selectedModelErrors = useMemo(
    () => selectedModels.filter((id) => modelStatusMap[id] === "error"),
    [modelStatusMap, selectedModels]
  );
  const selectedModelsLoading = useMemo(
    () => selectedModels.some((id) => {
      const statusForId = modelStatusMap[id];
      return statusForId === "loading" || statusForId === "idle" || statusForId === undefined;
    }),
    [modelStatusMap, selectedModels]
  );

  // Initialize Three.js scene
  const initThreeScene = useCallback(() => {
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
  }, []);

  // Load 3D model（二重ロード防止: ロード中・既にロード済みは skip）
  const loadModel = useCallback((id: string, modelPath: string, mtlPath?: string | null) => {
    if (!sceneRef.current) return;
    if (modelMapRef.current[id]) {
      setModelStatusMap((prev) => (prev[id] === "ready" ? prev : { ...prev, [id]: "ready" }));
      return;
    }
    if (loadingSetRef.current.has(id)) return;

    loadingSetRef.current.add(id);
    setModelStatusMap((prev) => ({ ...prev, [id]: "loading" }));
    const modelFormat = resolveModelFormat(modelPath);

    const onModelLoaded = (object: THREE.Object3D) => {
      loadingSetRef.current.delete(id);
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      // 極端に大きい/小さいモデルでも顔追従時に視認しやすいよう下限スケールを持たせる
      const normalizeScale = Math.max(0.012, 1.0 / maxDim);
      object.scale.setScalar(normalizeScale);

      box.setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);

      object.visible = false;
      object.userData.normalizeScale = normalizeScale;

      modelMapRef.current[id] = object;
      sceneRef.current?.add(object);
      setModelStatusMap((prev) => ({ ...prev, [id]: "ready" }));
    };

    let retryCount = 0;
    const maxRetries = 2;
    const loadOnce = () => {
      const onLoadError = () => {
        if (retryCount < maxRetries) {
          retryCount++;
          loadOnce();
          return;
        }
        loadingSetRef.current.delete(id);
        setModelStatusMap((prev) => ({ ...prev, [id]: "error" }));
        console.warn(`[loadModel] ${id} のロードに失敗しました`, { modelPath, modelFormat });
      };

      if (modelFormat === "fbx") {
        const fbxLoader = new FBXLoader();
        fbxLoader.load(modelPath, onModelLoaded, undefined, onLoadError);
        return;
      }

      const objLoader = new OBJLoader();
      if (mtlPath) {
        const mtlLoader = new MTLLoader();
        mtlLoader.load(
          mtlPath,
          (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load(modelPath, onModelLoaded, undefined, onLoadError);
          },
          undefined,
          () => {
            objLoader.load(modelPath, onModelLoaded, undefined, onLoadError);
          }
        );
        return;
      }

      objLoader.load(modelPath, onModelLoaded, undefined, onLoadError);
    };

    loadOnce();
  }, []);

  // FaceMesh result handler（detectionRefは毎フレーム更新、setDetectionは100msスロットル）
  const onFaceResults = useCallback((results: FaceMeshResults) => {
    if (!results.multiFaceLandmarks || !results.multiFaceLandmarks[0]) {
      detectionRef.current = null;
      setDetection(null);
      return;
    }
    const lm = results.multiFaceLandmarks[0];
    // 内カメ(user)はミラー表示のためx反転、外カメ(environment)はそのまま
    const isFront = facingModeRef.current === "user";
    const xs = lm.map((p) => (isFront ? 1 - p.x : p.x));
    const ys = lm.map((p) => p.y);
    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(1, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(1, Math.max(...ys));
    const newDetection = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
    detectionRef.current = newDetection;
    const now = performance.now();
    if (now - lastDetStateUpdateRef.current > 100) {
      setDetection(newDetection);
      lastDetStateUpdateRef.current = now;
    }
  }, []);

  useEffect(() => {
    faceResultHandlerRef.current = onFaceResults;
  }, [onFaceResults]);

  // Start camera + mediapipe
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (mediaPipeCameraRef.current) {
      mediaPipeCameraRef.current.stop();
      mediaPipeCameraRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (startInProgressRef.current || status === "starting" || status === "ready") return;
    startInProgressRef.current = true;

    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (!isLocalhost && typeof window !== "undefined" && !window.isSecureContext) {
      setErrorMessage(
        "カメラは HTTPS 環境でのみ利用できます。Cloudflare Tunnel の HTTPS URL でアクセスしてください。"
      );
      setStatus("denied");
      startInProgressRef.current = false;
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMessage("このブラウザはカメラに対応していません。");
      setStatus("denied");
      startInProgressRef.current = false;
      return;
    }

    setErrorMessage(null);
    setStatus("starting");
    try {
      stopStream();

      const [{ Camera }] = await Promise.all([import("@mediapipe/camera_utils")]);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingModeRef.current, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((err) => {
          if (err?.name !== "AbortError") throw err;
        });
        setStatus("ready");

        initThreeScene();
        const resolvedCatalog = await Promise.all(
          characterModelCatalog.map(async (modelInfo) => {
            const [signedModelUrl, signedMtlUrl] = await Promise.all([
              resolveClientStorageUrl(modelInfo.model_path, "model"),
              resolveClientStorageUrl(modelInfo.mtl_path, "model"),
            ]);
            const resolvedModelUrl =
              toLocalAssetUrl(modelInfo.model_path) ??
              signedModelUrl ??
              getModelUrl(modelInfo.model_path);
            const resolvedMtlUrl =
              toLocalAssetUrl(modelInfo.mtl_path) ??
              signedMtlUrl ??
              getModelUrl(modelInfo.mtl_path);
            return {
              id: modelInfo.id,
              modelUrl: resolvedModelUrl,
              mtlUrl: resolvedMtlUrl,
            };
          })
        );
        const nextSourceMap: Record<string, ModelSource> = {};
        const nextStatusMap: Record<string, ModelLoadStatus> = {};
        resolvedCatalog.forEach((item) => {
          if (!item.modelUrl) {
            nextStatusMap[item.id] = "error";
            return;
          }
          nextSourceMap[item.id] = { modelUrl: item.modelUrl, mtlUrl: item.mtlUrl ?? null };
          nextStatusMap[item.id] = modelMapRef.current[item.id] ? "ready" : "idle";
        });
        modelSourceMapRef.current = nextSourceMap;
        setModelStatusMap((prev) => ({ ...prev, ...nextStatusMap }));

        // FaceMesh: singleton 取得。初回エラー時は再生成を1回試みる
        if (!faceMeshRef.current) {
          try {
            const faceMesh = await acquireFaceMeshInstance();
            faceMesh.onResults((results) => faceResultHandlerRef.current(results));
            faceMeshRef.current = faceMesh;
          } catch (error) {
            if (!isFaceMeshModuleArgumentsError(error)) throw error;
            const recovered = await recreateFaceMeshInstance();
            recovered.onResults((results) => faceResultHandlerRef.current(results));
            faceMeshRef.current = recovered;
          }
        }

        // MediaPipe Camera: ビデオストリームに紐づくため常に新規作成
        const mpCamera = new Camera(videoRef.current, {
          onFrame: async () => {
            try {
              if (faceMeshRef.current && videoRef.current) {
                await faceMeshRef.current.send({ image: videoRef.current });
              }
            } catch (err) {
              if (isFaceMeshModuleArgumentsError(err) && !recoveringFaceMeshRef.current) {
                recoveringFaceMeshRef.current = true;
                try {
                  const recovered = await recreateFaceMeshInstance();
                  recovered.onResults((results) => faceResultHandlerRef.current(results));
                  faceMeshRef.current = recovered;
                } catch (recoverError) {
                  console.warn("faceMesh recovery error", recoverError);
                } finally {
                  recoveringFaceMeshRef.current = false;
                }
                return;
              }
              console.warn("faceMesh onFrame error", err);
            }
          },
          width: 1280,
          height: 720,
        });
        mediaPipeCameraRef.current = mpCamera;
        mpCamera.start();
      }
    } catch (e) {
      console.error("camera permission error", e);
      const message = e instanceof Error ? e.message : String(e);
      if (/module\.arguments/i.test(message)) {
        setErrorMessage(
          "FaceMesh の起動に失敗しました。自動復旧を試します。数秒待っても改善しない場合のみ再試行してください。"
        );
      } else {
        setErrorMessage("カメラアクセスが拒否されました。ブラウザ設定で許可してください。");
      }
      setStatus("denied");
    } finally {
      if (!unmountedRef.current) {
        startInProgressRef.current = false;
      }
    }
  }, [initThreeScene, loadModel, status, stopStream]);

  // カメラの内カメ/外カメ切替（モバイル用）
  const switchCamera = useCallback(() => {
    // ストリームと MediaPipe Camera を停止（FaceMesh は再利用するため維持）
    stopStream();
    // facingMode を反転
    const newMode = facingModeRef.current === "user" ? "environment" : "user";
    facingModeRef.current = newMode;
    setFacingMode(newMode);
    // status を idle に戻して自動再起動を発火
    setStatus("idle");
  }, [stopStream]);

  // Auto start camera on mount
  useEffect(() => {
    if (status === "idle") startCamera();
  }, [status, startCamera]);

  // 選択モデルを優先して読み込む（初回表示の遅延/失敗を軽減）
  useEffect(() => {
    if (status !== "ready") return;

    selectedModels.forEach((id) => {
      const currentStatus = modelStatusMap[id];
      if (modelMapRef.current[id]) {
        setModelStatusMap((prev) => (
          prev[id] === "ready" ? prev : { ...prev, [id]: "ready" }
        ));
        return;
      }

      const source = modelSourceMapRef.current[id];
      if (!source) {
        if (currentStatus !== "error") {
          setModelStatusMap((prev) => ({ ...prev, [id]: "error" }));
        }
        return;
      }

      if (currentStatus === "loading" || currentStatus === "ready") return;
      if (currentStatus === "error") return;
      loadModel(id, source.modelUrl, source.mtlUrl);
    });
  }, [loadModel, modelStatusMap, selectedModels, status]);


  // selectedModelsをrefで保持（render loop内で参照するため）
  const selectedModelsRef = useRef<string[]>(selectedModels);
  useEffect(() => {
    selectedModelsRef.current = selectedModels;
  }, [selectedModels]);

  // Three.js render loop（可視性はここで一元管理）
  useEffect(() => {
    if (status !== "ready" || !rendererRef.current || !sceneRef.current || !cameraRef.current)
      return;

    let animFrame: number;
    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      const det = detectionRef.current;
      const models = selectedModelsRef.current;
      const hasFace = !!det;

      // --- Three.js 視錐台サイズを動的に計算 ---
      const cam = cameraRef.current!;
      const vFov = cam.fov * (Math.PI / 180);
      const dist = cam.position.z;
      const frustumHeight = 2 * dist * Math.tan(vFov / 2);
      const frustumWidth = frustumHeight * cam.aspect;

      // --- object-cover クロップ補正値を計算 ---
      let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
      if (videoRef.current && overlayCanvasRef.current) {
        const videoW = videoRef.current.videoWidth || 1280;
        const videoH = videoRef.current.videoHeight || 720;
        const videoAspect = videoW / videoH;
        const canvasW = overlayCanvasRef.current.clientWidth || 640;
        const canvasH = overlayCanvasRef.current.clientHeight || 480;
        const displayAspect = canvasW / canvasH;
        if (videoAspect > displayAspect) {
          // ビデオが横長 → 左右がクロップされる
          const visibleFraction = displayAspect / videoAspect;
          scaleX = 1 / visibleFraction;
          offsetX = (1 - visibleFraction) / 2;
        } else {
          // ビデオが縦長 → 上下がクロップされる
          const visibleFraction = videoAspect / displayAspect;
          scaleY = 1 / visibleFraction;
          offsetY = (1 - visibleFraction) / 2;
        }
      }

      Object.entries(modelMapRef.current).forEach(([id, obj]) => {
        const isSelected = models.includes(id);
        if (isSelected && hasFace) {
          obj.visible = true;
          // ビデオ空間での顔中心・サイズ
          const cx = det!.x + det!.width / 2;
          const cy = det!.y + det!.height / 2;
          const w = det!.width;
          const h = det!.height;

          // ビデオ空間 → 表示空間に変換（object-cover クロップを補正）
          const displayCx = (cx - offsetX) * scaleX;
          const displayCy = (cy - offsetY) * scaleY;
          const faceDW = w * scaleX;
          const faceDH = h * scaleY;

          const screenMargin = 0.08;
          const clamp = (v: number) => Math.min(1 - screenMargin, Math.max(screenMargin, v));
          const n = models.length || 1;
          const idx = models.indexOf(id);
          const startAngle = n === 2 ? 0 : -90;
          const angle = (startAngle + (360 / n) * idx) * (Math.PI / 180);

          // 顔認識の矩形枠線を基準に、その辺のすぐ外側にモデルを配置
          const hw = faceDW / 2; // 枠の半幅
          const hh = faceDH / 2; // 枠の半高さ
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          // 角度方向で矩形の辺に到達する距離を計算
          const absCos = Math.abs(cosA);
          const absSin = Math.abs(sinA);
          let edgeDist: number;
          if (absCos < 0.001) {
            edgeDist = hh;
          } else if (absSin < 0.001) {
            edgeDist = hw;
          } else {
            edgeDist = Math.min(hw / absCos, hh / absSin);
          }
          // 枠の辺から少し外側にオフセット
          const outsideOffset = 0.05 + (n > 2 ? 0.01 * (n - 2) : 0);
          const slotDist = edgeDist + outsideOffset;
          const slotX = clamp(displayCx + slotDist * cosA);
          const slotY = clamp(displayCy + slotDist * sinA);

          // 表示空間 → Three.js ワールド座標（視錐台サイズで正確にマッピング）
          const targetX = (slotX - 0.5) * frustumWidth;
          const targetY = -(slotY - 0.5) * frustumHeight;
          const lerpFactor = 0.25;
          obj.position.x += (targetX - obj.position.x) * lerpFactor;
          obj.position.y += (targetY - obj.position.y) * lerpFactor;
          const sizeMultiplier = n <= 2 ? 1.0 : (n <= 4 ? 0.85 : 0.7);
          const normalizeScale = obj.userData.normalizeScale || 1;
          obj.scale.setScalar(normalizeScale * sizeMultiplier);
        } else {
          obj.visible = false;
        }
      });

      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [status]);

  // Cleanup
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      startInProgressRef.current = false;
      // stopStream は useCallback([]) なので参照は固定だが、依存配列サイズ警告を避けるためここで直接呼ぶ
      stopStream();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rendererRef.current?.dispose();
      faceMeshRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture photo
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const previewWidth = video.clientWidth || 720;
    const previewHeight = video.clientHeight || 480;
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const previewAspect = previewWidth / previewHeight;
    const sourceAspect = sourceWidth / sourceHeight;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceAspect > previewAspect) {
      sw = Math.round(sourceHeight * previewAspect);
      sx = Math.round((sourceWidth - sw) / 2);
    } else if (sourceAspect < previewAspect) {
      sh = Math.round(sourceWidth / previewAspect);
      sy = Math.round((sourceHeight - sh) / 2);
    }

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingModeRef.current === "user") {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }

    if (overlayCanvasRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
      // 最新フレームを描画してから重ねる
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      ctx.drawImage(overlayCanvasRef.current, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/png");
    sessionStorage.setItem("capturedPhoto", dataUrl);
    sessionStorage.setItem("capturedModels", JSON.stringify(selectedModels));
    if (detection) sessionStorage.setItem("capturedDetection", JSON.stringify(detection));

    // ページ遷移前にカメラ・FaceMeshを明示的に停止（許可状態はブラウザが保持）
    stopStream();
    faceMeshRef.current = null;
    setStatus("idle");

    router.push("/camera/edit");
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-2xl sm:aspect-[16/10]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />

        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <canvas ref={canvasRef} className="hidden" />

        {status === "ready" && detection && (
          <div
            className="pointer-events-none absolute rounded-2xl border-2 border-emerald-500/50 shadow-[0_0_40px_rgba(28,157,130,0.25)] transition"
            style={{
              left: `${detection.x * 100}%`,
              top: `${detection.y * 100}%`,
              width: `${detection.width * 100}%`,
              height: `${detection.height * 100}%`,
            }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {status !== "ready" && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-center shadow-lg">
              <Sparkles className="h-6 w-6 text-[#0f3a3a]" />
              <p className="text-sm text-[#0f1c1a]">
                {status === "starting" ? "カメラを起動しています…" : "カメラを許可してください"}
              </p>
            </div>
          )}
        </div>

        {status === "ready" && detection && selectedModelsReady && selectedModels.length > 0 && (
          <div
            className="absolute rounded-full bg-gradient-to-br from-emerald-300 to-amber-200 px-3 py-1 text-xs font-semibold text-[#0f1c1a] shadow-lg transition"
            style={{
              left: `${(detection.x + detection.width / 2) * 100}%`,
              top: `${detection.y * 100 - 4}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {selectedModels.map((id) => getCharacterNameById(id)).join(" / ")}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="flex items-center gap-3">
            {(status === "idle" || status === "denied") && (
              <Button
                onClick={startCamera}
                variant="glass"
                className="pointer-events-auto h-12 px-4 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                再開
              </Button>
            )}
            <button
              onClick={handleCapture}
              disabled={status !== "ready"}
              className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border-4 border-emerald-200/80 bg-white/90 text-[#0f1c1a] shadow-xl shadow-emerald-200/50 transition active:scale-95 disabled:opacity-60"
            >
              <CameraIcon className="h-7 w-7" />
            </button>
            {/* 内カメ/外カメ切替ボタン（モバイルのみ表示） */}
            {status === "ready" && (
              <button
                onClick={switchCamera}
                className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/80 text-[#0f1c1a] shadow-lg backdrop-blur transition active:scale-95 sm:hidden"
                aria-label="カメラ切替"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-900/10 p-3 ring-1 ring-emerald-900/10">
        {characters.map((c) => {
          const active = selectedModels.includes(c.id);
          const isDisabled = !active && selectedModels.length >= 5;
          return (
            <Button
              key={c.id}
              variant={active ? "primary" : "ghost"}
              size="sm"
              onClick={() => {
                setSelectedModels((prev) =>
                  active ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                );
                if (!active) {
                  setModelStatusMap((prev) => ({ ...prev, [c.id]: "idle" }));
                }
              }}
              disabled={isDisabled}
              className="gap-2"
            >
              {active ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {c.name}
            </Button>
          );
        })}
        <span className="text-xs text-emerald-900/70">複数選択可（最大5つ）</span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-emerald-900/75">撮影後に自動で編集画面へ移動します</p>
        <Button
          onClick={handleCapture}
          className="h-11 px-5 text-base"
          disabled={status !== "ready"}
        >
          <CameraIcon className="h-5 w-5" />
          シャッター
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {errorMessage}
        </div>
      )}
      {selectedModels.length > 0 && selectedModelsLoading && (
        <div className="rounded-xl border border-sky-200/60 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          モデルを読み込み中です。初回は数秒かかることがあります。
        </div>
      )}
      {selectedModelErrors.length > 0 && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          モデル読み込みに失敗: {selectedModelErrors.map((id) => getCharacterNameById(id)).join(" / ")}
          。一度選択を外して再度選択してください。
        </div>
      )}
    </div>
  );
}
