"use client";

import { CAPTURED_PHOTO_KEY, CAPTURED_DETECTION_KEY, CAPTURED_MODELS_KEY } from "@/lib/config";

import { computeCoverTransform } from "./coverFit";
import { initializeCameraScene, disposeCameraScene, getCameraFaceBounds, drawCameraFrame } from "./cameraRendering";
import { toLocalAssetUrl } from "@/lib/modelAssets";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Timer, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CameraCharacters } from "./CameraCharacters";
import { useCameraVideo } from "./useCameraVideo";
import { CameraPreview } from "./CameraPreview";
import { characterModelCatalog } from "@/lib/characters";
import { useCaptureTimer, type CaptureDelay } from "@/hooks/useCaptureTimer";
import { markCameraTiming, resetCameraTimings } from "@/lib/cameraTimings";
import { forgetFailedFaceMeshInstance, acquireFaceMeshInstance, recreateFaceMeshInstance, isFaceMeshModuleArgumentsError, type FaceMeshInstance, type FaceMeshResults, type FaceResultsHandler } from "./faceMesh";
import { createCameraStream, resolveActiveFacingMode, type CameraFacingMode } from "@/lib/cameraStream";
import { getModelUrl } from "@/lib/storage";
import { resolveClientStorageUrl } from "@/lib/storageSignedClient";
import type * as THREE from "three";
import { loadCameraModel, disposeCameraModel, normalizeCameraModel } from "@/lib/cameraModel";

import { CAMERA_VIDEO_MAX_MS } from "@/lib/cameraRecording";

import { layoutCameraModels } from "@/lib/cameraModelLayout";

type Detection = { x: number; y: number; width: number; height: number } | null;

type CameraStream = ReturnType<typeof createCameraStream>;
type ModelLoadStatus = "idle" | "loading" | "ready" | "error";
type ModelSource = { modelUrl: string; mtlUrl: string | null };
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
  const selectedModelsRef = useRef<string[]>(selectedModels);
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
  const { videoSupported, recordingPhase, recordedMilliseconds, recordedClip, sharingVideo,
    videoBusy, cancelRecording, stopRecording, beginRecording, shareRecordedVideo, canShareVideo,
    clearRecordedClip } = useCameraVideo(unmountedRef, setErrorMessage);

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
    initializeCameraScene({ overlayCanvasRef, sceneRef, cameraRef, rendererRef });
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
    const newDetection = getCameraFaceBounds(results.multiFaceLandmarks[0], activeFacingModeRef.current === "user");
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
            forgetFailedFaceMeshInstance(faceMeshRef.current);
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
    // カメラ・WebGLの外部リソース開始と開始中表示を同じライフサイクルで同期する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const [previousSelectedModels, setPreviousSelectedModels] = useState(selectedModels);
  if (selectedModels !== previousSelectedModels) {
    setPreviousSelectedModels(selectedModels);
    if (selectedModels.length === 0) {
      setDetection(null);
      setFaceHasResult(false);
    }
  }
  useEffect(() => {
    selectedModelsRef.current = selectedModels;
    if (selectedModels.length === 0) {
      detectionRef.current = null;
      faceHasResultRef.current = false;
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
        const canvasW = overlayCanvasRef.current.clientWidth || 640;
        const canvasH = overlayCanvasRef.current.clientHeight || 480;
        ({ scaleX, scaleY, offsetX, offsetY } = computeCoverTransform(videoW, videoH, canvasW, canvasH));
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
      for (const controller of pendingLoads.values()) controller.abort();
      pendingLoads.clear();
      for (const object of Object.values(modelMapRef.current)) disposeCameraModel(object);
      modelMapRef.current = {};
      disposeCameraScene({ sceneRef, rendererRef });
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
    drawCameraFrame({
      video: videoRef.current, canvas, resize, maxEdge,
      mirrored: activeFacingMode === "user", hasSelectedModels: selectedModels.length > 0,
      overlayCanvas: overlayCanvasRef.current, renderer: rendererRef.current,
      scene: sceneRef.current, camera: cameraRef.current,
    });
  }

  /**
   * 共通シャッターから録画を開始・停止する。
   * @returns なし
   * @example handleVideoShutter();
   */
  function handleVideoShutter(): void {
    if (stopRecording()) return;
    if (!canCapture || videoBusy || !videoSupported || document.hidden) return;
    if (selectedModels.length > 0 && (!detectionRef.current ||
      selectedModels.some((id) => !renderedModelsRef.current.includes(id) || !modelMapRef.current[id]?.visible))) return;
    cancelCapture();
    beginRecording(drawCaptureFrame, () => {
      stopStream();
      setStatus("captured");
    });
  }

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
      sessionStorage.removeItem(CAPTURED_DETECTION_KEY);
      sessionStorage.setItem(CAPTURED_MODELS_KEY, JSON.stringify(selectedModels));
      if (detection) sessionStorage.setItem(CAPTURED_DETECTION_KEY, JSON.stringify(detection));
      sessionStorage.setItem(CAPTURED_PHOTO_KEY, dataUrl);
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
              clearRecordedClip();
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
      {captureMode === "video" && <p className="text-sm tabular-nums text-app-ink-strong" role="status">{videoBusy ? `${Math.floor(recordedMilliseconds / 1000)}秒 / ${CAMERA_VIDEO_MAX_MS / 1000}秒${recordingPhase === "stopping" ? " 保存中…" : ""}` : `無音・最大${CAMERA_VIDEO_MAX_MS / 1000}秒`}</p>}
      <CameraPreview
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        canvasRef={canvasRef}
        activeFacingMode={activeFacingMode}
        status={status}
        detection={detection}
        remaining={remaining}
        captureMode={captureMode}
        videoBusy={videoBusy}
        recordingPhase={recordingPhase}
        canCapture={canCapture}
        busy={busy}
        captureDelay={captureDelay}
        startCamera={startCamera}
        handleVideoShutter={handleVideoShutter}
        cancelCapture={cancelCapture}
        startCapture={startCapture}
        switchCamera={switchCamera}
      />

      <CameraCharacters
        ready={status === "ready"}
        videoBusy={videoBusy}
        selectedModels={selectedModels}
        canCapture={canCapture}
        selectedModelErrors={selectedModelErrors}
        faceError={faceError}
        selectedModelsLoading={selectedModelsLoading}
        faceHasResult={faceHasResult}
        hasDetection={!!detection}
        onRetry={() => {
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
        }}
        onClear={() => { cancelCapture(); setSelectedModels([]); }}
        onToggle={(id, active) => {
          cancelCapture();
          if (!active) markCameraTiming(`${id}:selected`);
          setSelectedModels((prev) => active ? prev.filter((selected) => selected !== id) : [...prev, id]);
          if (!active) setModelStatusMap((prev) => ({ ...prev, [id]: "idle" }));
        }}
      />

      {captureMode === "photo" && <fieldset className="flex flex-wrap items-center gap-2" disabled={busy && remaining === null}>
        <legend className="sr-only">撮影タイマー</legend>
        <Timer aria-hidden="true" className="mr-1 h-5 w-5 text-app-accent-ink" />
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
        <div role="alert" className="rounded-xl border border-app-warning/30 bg-app-warning-surface px-3 py-2 text-xs text-app-warning">
          {errorMessage}
        </div>
      )}

    </div>
  );
}
