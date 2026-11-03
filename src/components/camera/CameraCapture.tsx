"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Camera as CameraIcon, RefreshCw, Check, SwitchCamera, Timer, X, Video, Square, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { characterModelCatalog, characters } from "@/lib/characters";
import { useCaptureTimer, type CaptureDelay } from "@/hooks/useCaptureTimer";
import { markCameraTiming, resetCameraTimings } from "@/lib/cameraTimings";
import { createCameraFaceWorker, type CameraFaceTracker, type CameraFaceResults } from "@/lib/cameraFaceWorker";
import { createCameraStream } from "@/lib/cameraStream";
import { getModelUrl } from "@/lib/storage";
import { resolveClientStorageUrl } from "@/lib/storageSignedClient";
import * as THREE from "three";
import { loadCameraModel, disposeCameraModel, normalizeCameraModel } from "@/lib/cameraModel";

import { CAMERA_VIDEO_MAX_EDGE, CAMERA_VIDEO_MAX_MS, getCameraRecordingMime, startCameraRecording, type CameraRecording } from "@/lib/cameraRecording";

import { layoutCameraModels } from "@/lib/cameraModelLayout";

type Detection = { x: number; y: number; width: number; height: number } | null;

type FaceMeshInstance = CameraFaceTracker;
type FaceMeshResults = CameraFaceResults;
type CameraStream = ReturnType<typeof createCameraStream>;
type FaceResultsHandler = (results: FaceMeshResults) => void;
type ModelLoadStatus = "idle" | "loading" | "ready" | "error";
type ModelSource = { modelUrl: string; mtlUrl: string | null };
type FaceMeshConstructor = typeof import("@mediapipe/face_mesh").FaceMesh;
type CameraFacingMode = "user" | "environment";

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

/**
 * ブラウザが返した facingMode がアプリ定義の値か判定する。
 *
 * @param value - 判定対象
 * @returns `user` または `environment` の場合 true
 * @example
 * isCameraFacingMode("user");
 */
function isCameraFacingMode(value: unknown): value is CameraFacingMode {
  return value === "user" || value === "environment";
}

/**
 * 起動した stream から実際に有効な facingMode を解決する。
 *
 * `getUserMedia` が要求どおりに切り替えられなかった環境では、
 * track settings を優先し、取得できない場合のみ要求値へフォールバックする。
 *
 * @param stream - 起動済み MediaStream
 * @param requestedFacingMode - 要求した facingMode
 * @returns 実際に採用された facingMode
 * @example
 * const activeFacingMode = resolveActiveFacingMode(stream, "environment");
 */
function resolveActiveFacingMode(
  stream: MediaStream,
  requestedFacingMode: CameraFacingMode
): CameraFacingMode {
  const actualFacingMode = stream.getVideoTracks()[0]?.getSettings().facingMode;
  return isCameraFacingMode(actualFacingMode) ? actualFacingMode : requestedFacingMode;
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

/**
 * カメラ映像へ岩手のキャラクターを重ねて撮影する。
 * @returns 撮影プレビューと操作・エラー案内
 * @example <CameraCapture />
 */
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
  const cameraStreamRef = useRef<CameraStream | null>(null);
  const modelMapRef = useRef<Record<string, THREE.Object3D>>({});
  const modelSourceMapRef = useRef<Record<string, ModelSource>>({});
  const detectionRef = useRef<Detection>(null);
  const modelLoadsRef = useRef(new Map<string, AbortController>());
  const lastDetStateUpdateRef = useRef(0);
  const startInProgressRef = useRef(false);
  const startAttemptRef = useRef(0);
  const unmountedRef = useRef(false);
  const recoveringFaceMeshRef = useRef(false);
  const faceResultHandlerRef = useRef<FaceResultsHandler>(() => undefined);
  const activeFacingModeRef = useRef<CameraFacingMode>("user");

  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [detection, setDetection] = useState<Detection>(null);
  const [renderedModels, setRenderedModels] = useState<string[]>([]);
  const renderedModelsRef = useRef<string[]>([]);
  const [faceHasResult, setFaceHasResult] = useState(false);
  const [faceError, setFaceError] = useState(false);
  const faceHasResultRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "denied" | "captured">("idle");
  // status を ref でも保持する。reactCompiler 有効下では useCallback のクロージャが
  // 古い status を掴んだままになり得るため、ガード判定は常に最新値を見る ref で行う。
  const statusRef = useRef(status);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelStatusMap, setModelStatusMap] = useState<Record<string, ModelLoadStatus>>({});
  const [activeFacingMode, setActiveFacingMode] = useState<CameraFacingMode>("user");
  const facingModeRef = useRef<CameraFacingMode>("user");
  const router = useRouter();
  const [captureMode, setCaptureMode] = useState<"photo" | "video">("photo");
  const [videoSupported, setVideoSupported] = useState(false);
  const [recordingPhase, setRecordingPhase] = useState<"idle" | "recording" | "stopping">("idle");
  const [recordedMilliseconds, setRecordedMilliseconds] = useState(0);
  const [recordedClip, setRecordedClip] = useState<{ file: File; url: string } | null>(null);
  const [sharingVideo, setSharingVideo] = useState(false);
  const recordingRef = useRef<CameraRecording | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const sharingVideoRef = useRef(false);
  const videoBusy = recordingPhase !== "idle";

  /**
   * 録画中の未完成データを破棄する。
   * @returns なし
   * @example cancelRecording();
   */
  const cancelRecording = useCallback(() => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    recording?.cancel();
    if (recording && !unmountedRef.current) {
      setRecordingPhase("idle");
      setErrorMessage("録画を中断しました。もう一度録画してください。");
    }
  }, []);

  useEffect(() => {
    setVideoSupported(getCameraRecordingMime() !== null);
    /** バックグラウンドの未完成動画を破棄する。@returns なし @example onHidden(); */
    function onHidden() { if (document.hidden) cancelRecording(); }
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("orientationchange", cancelRecording);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("orientationchange", cancelRecording);
      cancelRecording();
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, [cancelRecording]);


  // StrictModeでeffectが再実行されても、起動前にマウント状態を復帰する。
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  // status の最新値を ref に同期する（auto-start 効果より前に宣言し先に走らせる）
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    activeFacingModeRef.current = activeFacingMode;
  }, [activeFacingMode]);

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

  const [captureDelay, setCaptureDelay] = useState<CaptureDelay>(0);
  const canCapture = status === "ready" && (selectedModels.length === 0 ||
    (selectedModelsReady && detection !== null && selectedModels.every((id) => renderedModels.includes(id))));
  const { remaining, busy, start: startCapture, cancel: cancelCapture } = useCaptureTimer(canCapture, handleCapture);

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

  /**
   * 選択モデルの読み込みを一つだけ開始し、終了した世代だけを反映する。
   * @param id - キャラクターID
   * @param modelPath - モデルURL
   * @param mtlPath - 任意の材質URL
   * @returns なし
   * @example loadModel(id, source.modelUrl, source.mtlUrl);
   */
  const loadModel = useCallback((id: string, modelPath: string, mtlPath?: string | null) => {
    if (!sceneRef.current || modelLoadsRef.current.has(id)) return;
    if (modelMapRef.current[id]) {
      setModelStatusMap((prev) => ({ ...prev, [id]: "ready" }));
      return;
    }
    const controller = new AbortController();
    modelLoadsRef.current.set(id, controller);
    markCameraTiming(`${id}:load:start`);
    setModelStatusMap((prev) => ({ ...prev, [id]: "loading" }));
    void loadCameraModel(id, modelPath, mtlPath ?? null, controller.signal).then((object) => {
      if (unmountedRef.current || controller.signal.aborted || modelLoadsRef.current.get(id) !== controller) {
        disposeCameraModel(object);
        return;
      }
      markCameraTiming(`${id}:object-ready`);
      const model = normalizeCameraModel(object);
      model.visible = false;
      modelMapRef.current[id] = model;
      sceneRef.current?.add(model);
      setModelStatusMap((prev) => ({ ...prev, [id]: "ready" }));
    }).catch(() => {
      if (!unmountedRef.current && !controller.signal.aborted) {
        setModelStatusMap((prev) => ({ ...prev, [id]: "error" }));
      }
    }).finally(() => {
      if (modelLoadsRef.current.get(id) === controller) modelLoadsRef.current.delete(id);
    });
  }, []);

  // FaceMesh result handler（detectionRefは毎フレーム更新、setDetectionは100msスロットル）
  const onFaceResults = useCallback((results: FaceMeshResults) => {
    if (unmountedRef.current || selectedModelsRef.current.length === 0) return;
    markCameraTiming("face:first-result");
    if (!faceHasResultRef.current) {
      faceHasResultRef.current = true;
      setFaceHasResult(true);
    }
    if (!results.multiFaceLandmarks || !results.multiFaceLandmarks[0]) {
      detectionRef.current = null;
      setDetection(null);
      return;
    }
    const lm = results.multiFaceLandmarks[0];
    // 内カメ(user)はミラー表示のためx反転、外カメ(environment)はそのまま
    const isFront = activeFacingModeRef.current === "user";
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
    markCameraTiming("face:first-detected");
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
    cancelRecording();
    faceMeshRef.current?.onResults(() => undefined);
    detectionRef.current = null;
    setDetection(null);
    faceHasResultRef.current = false;
    setFaceHasResult(false);
    setFaceError(false);
    renderedModelsRef.current = [];
    setRenderedModels([]);
    if (cameraStreamRef.current) {
      cameraStreamRef.current.stop();
      cameraStreamRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      // 表示要素に残ったstreamのトラックも確実に停止する
      const currentSrc = videoRef.current.srcObject;
      if (currentSrc instanceof MediaStream) {
        currentSrc.getTracks().forEach((track) => track.stop());
      }
      videoRef.current.srcObject = null;
    }
    detectionRef.current = null;
    setDetection(null);
  }, [cancelRecording]);

  /**
   * 指定した facingMode でカメラ起動を行う。
   *
   * @param targetFacingMode - 起動したい facingMode。省略時は最後に要求した向き
   * @returns なし
   * @example
   * await startCamera("environment");
   */
  const startCamera = useCallback(async (targetFacingMode: CameraFacingMode = facingModeRef.current) => {
    if (startInProgressRef.current || statusRef.current === "starting" || statusRef.current === "ready") return;
    startInProgressRef.current = true;
    const attempt = ++startAttemptRef.current;
    resetCameraTimings();
    markCameraTiming("camera:start");

    if (!window.isSecureContext) {
      setErrorMessage(
        "カメラを使うには安全な接続が必要です。ページを再読み込みして、https で開き直してください。"
      );
      setStatus("denied");
      startInProgressRef.current = false;
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMessage("この端末ではカメラ機能を利用できませんでした。別のブラウザや端末でお試しください。");
      setStatus("denied");
      startInProgressRef.current = false;
      return;
    }

    setErrorMessage(null);
    setStatus("starting");
    try {
      stopStream();
      facingModeRef.current = targetFacingMode;

      if (!videoRef.current || unmountedRef.current) return;
      const activeCamera = createCameraStream(videoRef.current, {
        facingMode: targetFacingMode,
        onError: () => {
          setErrorMessage("カメラの処理を続けられませんでした。もう一度お試しください。");
          setStatus("denied");
        },
        onFrame: async () => {
          try {
            if (selectedModelsRef.current.length > 0 && faceMeshRef.current && videoRef.current) {
              markCameraTiming("face:first-send");
              await faceMeshRef.current.send({ image: videoRef.current });
              markCameraTiming("face:first-send-end");
            }
          } catch (err) {
            if (unmountedRef.current || attempt !== startAttemptRef.current) return;
            if (isFaceMeshModuleArgumentsError(err) && !recoveringFaceMeshRef.current) {
              recoveringFaceMeshRef.current = true;
              try {
                const recovered = await recreateFaceMeshInstance();
                if (unmountedRef.current || attempt !== startAttemptRef.current) return;
                recovered.onResults((results) => faceResultHandlerRef.current(results));
                faceMeshRef.current = recovered;
              } catch (recoverError) {
                console.warn("faceMesh recovery error", recoverError);
              } finally {
                recoveringFaceMeshRef.current = false;
              }
              return;
            }
            if (sharedFaceMesh === faceMeshRef.current) {
              sharedFaceMesh = null;
              sharedFaceMeshPromise = null;
            }
            void faceMeshRef.current?.close();
            faceMeshRef.current = null;
            detectionRef.current = null;
            setDetection(null);
            faceHasResultRef.current = false;
            setFaceHasResult(false);
            setFaceError(true);
            console.warn("faceMesh onFrame error", err);
          }
        },
      });
      // 起動待ちの間に画面を離れてもstopStreamでキャンセルできるよう先に保持する。
      cameraStreamRef.current = activeCamera;
      await activeCamera.start();
      if (unmountedRef.current || attempt !== startAttemptRef.current) return;

      // 起動後の実 facingMode を track settings から解決して反映する
      const activeStream = videoRef.current.srcObject;
      const resolvedFacingMode =
        activeStream instanceof MediaStream
          ? resolveActiveFacingMode(activeStream, targetFacingMode)
          : targetFacingMode;
      facingModeRef.current = resolvedFacingMode;
      setActiveFacingMode(resolvedFacingMode);
      setStatus("ready");

      markCameraTiming("camera:playing");
      markCameraTiming("renderer:initialize:start");
      initThreeScene();
      markCameraTiming("renderer:initialize:end");
      markCameraTiming("urls:start");
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
      if (unmountedRef.current || attempt !== startAttemptRef.current) return;
      markCameraTiming("urls:end");
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
      // （onFrame は faceMeshRef 未取得の間 no-op のため Camera 起動を先行しても安全）
      if (!faceMeshRef.current) {
        try {
          const faceMesh = await acquireFaceMeshInstance();
          if (unmountedRef.current || attempt !== startAttemptRef.current) return;
          faceMesh.onResults((results) => faceResultHandlerRef.current(results));
          faceMeshRef.current = faceMesh;
          markCameraTiming("face:ready");
        } catch (error) {
          if (!isFaceMeshModuleArgumentsError(error)) {
            if (!unmountedRef.current && attempt === startAttemptRef.current) setFaceError(true);
            return;
          }
          const recovered = await recreateFaceMeshInstance();
          if (unmountedRef.current || attempt !== startAttemptRef.current) return;
          recovered.onResults((results) => faceResultHandlerRef.current(results));
          faceMeshRef.current = recovered;
        }
      }
      faceMeshRef.current?.onResults((results) => faceResultHandlerRef.current(results));
    } catch (e) {
      if (unmountedRef.current || attempt !== startAttemptRef.current) return;
      stopStream();
      console.error("camera permission error", e);
      const message = e instanceof Error ? e.message : String(e);
      const domName = e instanceof DOMException ? e.name : "";
      if (/module\.arguments/i.test(message)) {
        setErrorMessage(
          "カメラ演出の準備に少し時間がかかっています。数秒待っても改善しない場合のみ再試行してください。"
        );
      } else if (/constructor is unavailable/i.test(message)) {
        setErrorMessage(
          "カメラ演出ライブラリの初期化に失敗しました。ページを再読み込みしてから再試行してください。"
        );
      } else if (domName === "NotReadableError" || domName === "TrackStartError") {
        setErrorMessage(
          "カメラの切り替えに失敗しました。ページを再読み込みしてからお試しください。"
        );
      } else if (domName === "NotFoundError" || domName === "DevicesNotFoundError") {
        setErrorMessage("カメラが見つかりません。端末のカメラをご確認ください。");
      } else if (domName === "TimeoutError") {
        setErrorMessage("カメラの準備が時間内に終わりませんでした。許可を確認して、もう一度お試しください。");
      } else {
        setErrorMessage("カメラの利用が許可されていません。ブラウザ設定からカメラを許可してください。");
      }
      setStatus("denied");
    } finally {
      if (!unmountedRef.current && attempt === startAttemptRef.current) {
        startInProgressRef.current = false;
      }
    }
  }, [initThreeScene, stopStream]);

  /**
   * 内カメと外カメを切り替える。
   *
   * @returns なし
   * @example
   * switchCamera();
   */
  const switchCamera = useCallback(() => {
    cancelCapture();
    startAttemptRef.current += 1;
    startInProgressRef.current = false;
    const newMode = facingModeRef.current === "user" ? "environment" : "user";
    facingModeRef.current = newMode;
    setErrorMessage(null);
    stopStream();
    setStatus("idle");
  }, [stopStream, cancelCapture]);

  // 権限喪失・他アプリによる映像中断では予約を破棄し、再試行を表示する。
  useEffect(() => {
    if (status !== "ready") return;
    const stream = videoRef.current?.srcObject;
    if (!(stream instanceof MediaStream)) return;
    const tracks = stream.getVideoTracks();
    /**
     * 映像の終了・中断時に予約とストリームを停止する。
     * @returns なし
     * @example track.addEventListener("ended", onUnavailable);
     */
    function onUnavailable() {
      cancelCapture();
      stopStream();
      setErrorMessage("カメラが停止しました。もう一度お試しください。");
      setStatus("denied");
    }
    tracks.forEach((track) => {
      track.addEventListener("ended", onUnavailable);
      track.addEventListener("mute", onUnavailable);
    });
    return () => tracks.forEach((track) => {
      track.removeEventListener("ended", onUnavailable);
      track.removeEventListener("mute", onUnavailable);
    });
  }, [status, stopStream, cancelCapture]);

  // Auto start camera on mount
  useEffect(() => {
    if (status === "idle") startCamera();
  }, [status, startCamera]);

  // 選択モデルを優先して読み込む（初回表示の遅延/失敗を軽減）
  useEffect(() => {
    for (const [id, controller] of modelLoadsRef.current) {
      if (!selectedModels.includes(id)) {
        controller.abort();
        modelLoadsRef.current.delete(id);
        setModelStatusMap((prev) => ({ ...prev, [id]: "idle" }));
      }
    }
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
    if (selectedModels.length === 0) {
      detectionRef.current = null;
      setDetection(null);
      faceHasResultRef.current = false;
      setFaceHasResult(false);
    }
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

      const loadedModels = models.filter((id) => modelMapRef.current[id]);
      const sizeMultiplier = models.length <= 2 ? 1 : models.length <= 4 ? 0.85 : 0.7;
      const slots = hasFace ? layoutCameraModels({
        x: (det!.x - offsetX) * scaleX, y: (det!.y - offsetY) * scaleY,
        width: det!.width * scaleX, height: det!.height * scaleY,
      }, loadedModels.map((id) => {
        const size = modelMapRef.current[id].userData.normalizedSize as THREE.Vector3;
        const depth = size.z * sizeMultiplier / (2 * dist);
        // 前面の頂点は中心より大きく投影される。画面端でも収まる外形を確保する。
        return {
          width: (size.x * sizeMultiplier / frustumWidth + depth) / (1 - depth),
          height: (size.y * sizeMultiplier / frustumHeight + depth) / (1 - depth),
        };
      })) : [];
      Object.entries(modelMapRef.current).forEach(([id, obj]) => {
        const slot = slots[loadedModels.indexOf(id)];
        obj.visible = !!slot;
        if (!slot) return;
        // 位置と倍率を同じフレームで適用し、移動途中で顔や画面端を横切らせない。
        obj.position.set((slot.x + slot.width / 2 - 0.5) * frustumWidth,
          -(slot.y + slot.height / 2 - 0.5) * frustumHeight, 0);
        obj.scale.setScalar(obj.userData.normalizeScale * sizeMultiplier * slot.scale);
      });

      markCameraTiming("renderer:first-submit:start");
      const firstVisible = models.filter((id) => modelMapRef.current[id]?.visible);
      for (const id of firstVisible) markCameraTiming(`${id}:visible-submit:start`);
      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
      markCameraTiming("renderer:first-submit:end");
      for (const id of firstVisible) markCameraTiming(`${id}:visible-submit:end`);
      if (firstVisible.join(",") !== renderedModelsRef.current.join(",")) {
        renderedModelsRef.current = firstVisible;
        setRenderedModels(firstVisible);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [status]);

  // Cleanup
  useEffect(() => {
    const pendingLoads = modelLoadsRef.current;
    return () => {
      unmountedRef.current = true;
      startAttemptRef.current += 1;
      startInProgressRef.current = false;
      // streamと描画資源を同じcleanupで解放する
      stopStream();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      for (const controller of pendingLoads.values()) controller.abort();
      pendingLoads.clear();
      for (const object of Object.values(modelMapRef.current)) disposeCameraModel(object);
      modelMapRef.current = {};
      sceneRef.current?.clear();
      rendererRef.current?.dispose();
      rendererRef.current?.forceContextLoss();
      faceMeshRef.current?.onResults(() => undefined);
      faceMeshRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * プレビューと同じクロップ・鏡像で映像とモデルを合成する。
   * @param canvas - 写真または動画の出力canvas
   * @param resize - 初回のみ出力寸法を設定する
   * @param maxEdge - 動画の長辺上限。写真は元の撮影寸法を使う
   * @returns なし
   * @example drawCaptureFrame(canvas, true, CAMERA_VIDEO_MAX_EDGE);
   */
  function drawCaptureFrame(canvas: HTMLCanvasElement, resize: boolean, maxEdge?: number): void {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error("Camera frame unavailable");
    const previewWidth = video.clientWidth || 720;
    const previewHeight = video.clientHeight || 480;
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const previewAspect = resize ? previewWidth / previewHeight : canvas.width / canvas.height;
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

    if (resize) {
      const scale = maxEdge ? Math.min(1, maxEdge / Math.max(sw, sh)) : 1;
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    if (activeFacingMode === "user") {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }

    if (selectedModels.length > 0 && overlayCanvasRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
      // 最新フレームを描画してから重ねる
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      ctx.drawImage(overlayCanvasRef.current, 0, 0, canvas.width, canvas.height);
    }

  }

  /**
   * 共通シャッターから録画を開始・停止する。
   * @returns なし
   * @example handleVideoShutter();
   */
  function handleVideoShutter(): void {
    if (recordingRef.current) {
      setRecordingPhase("stopping");
      recordingRef.current.stop();
      return;
    }
    if (!canCapture || videoBusy || !videoSupported || document.hidden) return;
    if (selectedModels.length > 0 && (!detectionRef.current ||
      selectedModels.some((id) => !renderedModelsRef.current.includes(id) || !modelMapRef.current[id]?.visible))) return;
    cancelCapture();
    setErrorMessage(null);
    setRecordedMilliseconds(0);
    try {
      const output = document.createElement("canvas");
      drawCaptureFrame(output, true, CAMERA_VIDEO_MAX_EDGE);
      const recording = startCameraRecording(output, () => drawCaptureFrame(output, false), (ms) => setRecordedMilliseconds(Math.floor(ms / 1000) * 1000));
      recordingRef.current = recording;
      setRecordingPhase("recording");
      void recording.result.then((blob) => {
        if (unmountedRef.current || recordingRef.current !== recording) return;
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `iwate-trip.${extension}`, { type: blob.type });
        const url = URL.createObjectURL(file);
        recordingRef.current = null;
        recordedUrlRef.current = url;
        setRecordedClip({ file, url });
        setRecordingPhase("idle");
        stopStream();
        setStatus("captured");
      }).catch(() => {
        if (unmountedRef.current || recordingRef.current !== recording) return;
        recordingRef.current = null;
        setRecordingPhase("idle");
        setErrorMessage("動画を保存できませんでした。もう一度録画するか、写真を撮ってください。");
      });
    } catch {
      setRecordingPhase("idle");
      setErrorMessage("録画を開始できませんでした。もう一度試すか、写真を撮ってください。");
    }
  }

  /**
   * 準備済み動画ファイルをユーザー操作と同じ実行内で共有する。
   * @returns 共有操作の完了
   * @example void shareRecordedVideo();
   */
  async function shareRecordedVideo(): Promise<void> {
    if (!recordedClip || sharingVideoRef.current) return;
    sharingVideoRef.current = true;
    setSharingVideo(true);
    setErrorMessage(null);
    try { await navigator.share({ files: [recordedClip.file] }); } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setErrorMessage("共有できませんでした。動画を保存して添付してください。");
    } finally { sharingVideoRef.current = false; setSharingVideo(false); }
  }

  let canShareVideo = false;
  try { canShareVideo = !!recordedClip && typeof navigator.share === "function" && navigator.canShare?.({ files: [recordedClip.file] }) === true; } catch { /* 保存操作は常に残す。 */ }

  /**
   * 表示中のカメラとキャラクターを合成し編集画面へ渡す。
   * @returns 保存と編集画面への遷移を開始できた場合true、再試行可能な失敗はfalse
   * @example handleCapture();
   */
  function handleCapture(): boolean {
    if (!canCapture || !videoRef.current || !canvasRef.current) return false;
    // 状態更新前の顔喪失や描画待ちでも、選択モデルのない写真を保存しない。
    if (selectedModels.length > 0 && (!detectionRef.current ||
      selectedModels.some((id) => !renderedModelsRef.current.includes(id) || !modelMapRef.current[id]?.visible))) return false;
    const stream = videoRef.current.srcObject;
    if (!(stream instanceof MediaStream) || !stream.getVideoTracks().some((track) => track.readyState === "live" && !track.muted)) return false;
    if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
    const canvas = canvasRef.current;
    try { drawCaptureFrame(canvas, true); } catch {
      setErrorMessage("撮影できませんでした。もう一度お試しください。");
      return false;
    }

    try {
      const dataUrl = canvas.toDataURL("image/png");
      // 前の写真の顔位置を次の撮影へ持ち越さない。
      sessionStorage.removeItem("capturedDetection");
      sessionStorage.setItem("capturedModels", JSON.stringify(selectedModels));
      if (detection) sessionStorage.setItem("capturedDetection", JSON.stringify(detection));
      sessionStorage.setItem("capturedPhoto", dataUrl);
    } catch {
      setErrorMessage("撮影した写真を一時保存できませんでした。ブラウザの空き容量や保存設定を確認して、もう一度撮影してください。");
      return false;
    }

    // ページ遷移前にカメラ・FaceMeshを明示的に停止（許可状態はブラウザが保持）
    stopStream();
    faceMeshRef.current = null;
    setStatus("captured");

    router.push("/camera/edit");
    return true;
  }

  return (
    <div className="space-y-4">
      {recordedClip && (
        <div className="space-y-3">
          <video src={recordedClip.url} controls playsInline aria-label="撮影した動画" className="max-h-[65dvh] w-full rounded-3xl bg-black" />
          <div className="flex flex-wrap gap-2">
            <a href={recordedClip.url} download={recordedClip.file.name} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 text-white"><Download className="h-4 w-4" />動画を保存</a>
            {canShareVideo && <Button onClick={() => void shareRecordedVideo()} disabled={sharingVideo}><Share2 className="h-4 w-4" />動画を共有</Button>}
            <Button variant="outline" disabled={sharingVideo} onClick={() => {
              URL.revokeObjectURL(recordedClip.url);
              recordedUrlRef.current = null;
              setRecordedClip(null);
              setErrorMessage(null);
              setStatus("idle");
            }}>撮影に戻る</Button>
          </div>
        </div>
      )}
      <div className={recordedClip ? "hidden" : "space-y-4"}>
      <fieldset className="flex gap-2" disabled={videoBusy || busy}>
        <legend className="sr-only">撮影モード</legend>
        <Button variant={captureMode === "photo" ? "primary" : "outline"} aria-pressed={captureMode === "photo"} onClick={() => { cancelCapture(); setCaptureMode("photo"); }}>写真</Button>
        {videoSupported && <Button variant={captureMode === "video" ? "primary" : "outline"} aria-pressed={captureMode === "video"} onClick={() => { cancelCapture(); setCaptureMode("video"); }}>動画</Button>}
      </fieldset>
      {captureMode === "video" && <p className="text-sm tabular-nums text-emerald-950" role="status">{videoBusy ? `${Math.floor(recordedMilliseconds / 1000)}秒 / ${CAMERA_VIDEO_MAX_MS / 1000}秒${recordingPhase === "stopping" ? " 保存中…" : ""}` : `無音・最大${CAMERA_VIDEO_MAX_MS / 1000}秒`}</p>}
      <div className="relative aspect-[4/3] w-full max-h-[calc(100dvh-8rem)] overflow-hidden rounded-3xl border border-emerald-900/10 bg-white sm:aspect-[16/10]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          style={{ transform: activeFacingMode === "user" ? "scaleX(-1)" : "none" }}
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
          {status === "starting" && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-center shadow-lg">
              <Sparkles className="h-6 w-6 text-[#0f3a3a]" />
              <p className="text-sm text-[#0f1c1a]">
                カメラを準備中…
              </p>
            </div>
          )}
        </div>

        {remaining !== null && (
          <div role="status" aria-live="assertive" aria-label={`${remaining}秒後に撮影`} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-2xl bg-black/60 px-6 py-3 text-5xl font-semibold tabular-nums text-white">{remaining}</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="flex items-center gap-3">
            {(status === "idle" || status === "denied") && (
              <Button
                onClick={() => {
                  void startCamera();
                }}
                variant="outline"
                className="pointer-events-auto h-12 px-4 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                もう一度試す
              </Button>
            )}
            <button
              type="button"
              onClick={() => captureMode === "video" ? handleVideoShutter() : remaining !== null ? cancelCapture() : startCapture(captureDelay)}
              aria-label={captureMode === "video" ? (videoBusy ? "録画を停止" : "録画を開始") : remaining !== null ? "タイマーを取り消す" : "写真を撮る"}
              disabled={captureMode === "video" ? recordingPhase === "stopping" || (!videoBusy && !canCapture) : remaining === null && (!canCapture || busy)}
              className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border-4 border-emerald-200/80 bg-white/90 text-[#0f1c1a] shadow-xl shadow-emerald-200/50 transition active:scale-95 disabled:opacity-60"
            >
              {captureMode === "video" ? (videoBusy ? <Square className="h-7 w-7 fill-red-700 text-red-700" aria-hidden="true" /> : <Video className="h-7 w-7" aria-hidden="true" />) : remaining !== null ? <X className="h-7 w-7" aria-hidden="true" /> : <CameraIcon className="h-7 w-7" aria-hidden="true" />}
            </button>
            {/* 内カメ/外カメ切替ボタン（モバイルのみ表示） */}
            {status === "ready" && (
              <button
                onClick={switchCamera}
                disabled={videoBusy}
                className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-white/80 text-[#0f1c1a] shadow-lg backdrop-blur transition active:scale-95 sm:hidden"
                aria-label="カメラ切替"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {status === "ready" && !videoBusy && selectedModels.length > 0 && !canCapture && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-900/10 bg-white p-3">
          <p role={selectedModelErrors.length > 0 || faceError ? "alert" : "status"} className="mr-auto text-sm text-[#0f3a3a]">
            {selectedModelErrors.length > 0
              ? `${selectedModelErrors.map(getCharacterNameById).join("・")}を読み込めませんでした`
              : faceError ? "顔検出を開始できませんでした"
              : selectedModelsLoading || !faceHasResult
                ? "キャラクターを準備中…"
                : !detection ? "顔をカメラに向ける" : "少し離れる"}
          </p>
          {(selectedModelErrors.length > 0 || faceError) && (
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => {
              cancelCapture();
              if (faceError) {
                setFaceError(false);
                const attempt = startAttemptRef.current;
                void recreateFaceMeshInstance().then((tracker) => {
                  if (unmountedRef.current || attempt !== startAttemptRef.current) return;
                  tracker.onResults((results) => faceResultHandlerRef.current(results));
                  faceMeshRef.current = tracker;
                }).catch(() => {
                  if (!unmountedRef.current && attempt === startAttemptRef.current) setFaceError(true);
                });
              }
              setModelStatusMap((prev) => ({ ...prev, ...Object.fromEntries(selectedModelErrors.map((id) => [id, "idle" as const])) }));
            }}>読み込み直す</Button>
          )}
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => { cancelCapture(); setSelectedModels([]); }}>
            キャラクターを外す
          </Button>
        </div>
      )}

      <div className="glass flex items-center gap-2 overflow-x-auto rounded-2xl border border-emerald-900/10 p-3 ring-1 ring-emerald-900/10 sm:flex-wrap">
        {characters.map((c) => {
          const active = selectedModels.includes(c.id);
          const isDisabled = !active && selectedModels.length >= 5;
          return (
            <Button
              key={c.id}
              variant={active ? "primary" : "ghost"}
              size="sm"
              onClick={() => {
                cancelCapture();
                if (!active) markCameraTiming(`${c.id}:selected`);
                setSelectedModels((prev) =>
                  active ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                );
                if (!active) {
                  setModelStatusMap((prev) => ({ ...prev, [c.id]: "idle" }));
                }
              }}
              disabled={isDisabled || videoBusy}
              aria-pressed={active}
              className="min-h-11 shrink-0 gap-2 whitespace-nowrap"
            >
              {active ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {c.name}
            </Button>
          );
        })}
        <span className="shrink-0 text-xs text-emerald-900/70">最大5体</span>
      </div>

      {captureMode === "photo" && <fieldset className="flex flex-wrap items-center gap-2" disabled={busy && remaining === null}>
        <legend className="sr-only">撮影タイマー</legend>
        <Timer aria-hidden="true" className="mr-1 h-5 w-5 text-emerald-900" />
        {([0, 3, 10] as const).map((delay) => (
          <Button key={delay} type="button" variant={captureDelay === delay ? "primary" : "outline"}
            aria-pressed={captureDelay === delay} className="min-h-11 min-w-14"
            onClick={() => { cancelCapture(); setCaptureDelay(delay); }}>
            {delay === 0 ? "オフ" : `${delay}秒`}
          </Button>
        ))}
      </fieldset>}
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {errorMessage}
        </div>
      )}

    </div>
  );
}
