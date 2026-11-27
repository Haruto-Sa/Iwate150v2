"use client";

import { addViewerLights, createViewerControls } from "./characterScene";
import { fitObjectToView } from "./characterViewFit";
import { applyRenderProfile } from "./characterRenderProfile";
import { applyLegacyMeshFixes } from "@/lib/characterMaterials";
import { loadModelFromCandidates, type ModelLoadError, type ModelLoadSuccess } from "./characterModelLoader";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Minus, Plus, RotateCw, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CharacterRenderProfile } from "@/lib/types";

export type CharacterViewerHandle = {
  scaleUp: () => void;
  scaleDown: () => void;
  toggleRotation: () => boolean;
  resetView: () => void;
};

type Props = {
  characterId?: string;
  modelCandidates: string[];
  mtlCandidates?: string[];
  renderProfile?: CharacterRenderProfile;
  disableProfilePositionOffset?: boolean;
  controlsPlacement?: "overlay" | "bottom" | "none";
  className?: string;
  candidateRetryCount?: number;
  autoRetryCount?: number;
};

type ViewerErrorType = "model" | "webgl";

/** シーン背景色（純白を避けて白モデルでも視認できるようにする） */
const SCENE_BG_COLOR = 0xf0f2ef;
/** 各候補URLに対するデフォルトリトライ回数 */
const DEFAULT_CANDIDATE_RETRY_COUNT = 2;
/** 読み込み失敗時のデフォルト自動再試行回数 */
const DEFAULT_AUTO_RETRY_COUNT = 1;
/** 初期化を遅延するマウントサイズ判定の待機フレーム上限（約6秒相当） */
const MAX_WAIT_FRAMES_FOR_VIEWPORT_READY = 360;

export const CharacterViewer = forwardRef<CharacterViewerHandle, Props>(function CharacterViewer(
  {
    characterId,
    modelCandidates,
    mtlCandidates = [],
    renderProfile,
    disableProfilePositionOffset = false,
    controlsPlacement = "overlay",
    className = "",
    candidateRetryCount = DEFAULT_CANDIDATE_RETRY_COUNT,
    autoRetryCount = DEFAULT_AUTO_RETRY_COUNT,
  }: Props,
  ref
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const cameraInstanceRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsInstanceRef = useRef<OrbitControls | null>(null);
  const profileOffsetRef = useRef(new THREE.Vector3());
  const basePositionRef = useRef(new THREE.Vector3());
  const baseQuaternionRef = useRef(new THREE.Quaternion());
  const baseScaleVectorRef = useRef(new THREE.Vector3(1, 1, 1));
  const hasBaseTransformRef = useRef(false);
  const baseScaleRef = useRef(1);
  const rotatingRef = useRef(true);
  /** リセット時に復元するカメラ距離 */
  const initialCameraDistanceRef = useRef(3.8);
  /** リセット時に復元するオブジェクト初期回転 */
  const initialObjectRotationRef = useRef(new THREE.Euler());
  const autoRetriedSessionKeyRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorType, setErrorType] = useState<ViewerErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [autoRetryNonce, setAutoRetryNonce] = useState(0);

  const normalizedModelCandidates = useMemo(
    () => [...new Set(modelCandidates.filter((url): url is string => Boolean(url)))],
    [modelCandidates]
  );
  const normalizedMtlCandidates = useMemo(
    () => [...new Set(mtlCandidates.filter((url): url is string => Boolean(url)))],
    [mtlCandidates]
  );

  /**
   * 候補URL配列の「値ベース」のキーを生成する。
   * 配列参照が変わっても中身が同じなら同一文字列を返すため、
   * useEffect の依存配列で不要な再実行を防止できる。
   */
  const candidatesKey = useMemo(
    () => JSON.stringify([normalizedModelCandidates, normalizedMtlCandidates]),
    [normalizedModelCandidates, normalizedMtlCandidates]
  );
  const viewerSessionKey = useMemo(
    () => `${characterId ?? "unknown"}:${candidatesKey}`,
    [characterId, candidatesKey]
  );

  useEffect(() => {
    autoRetriedSessionKeyRef.current = null;
    setAutoRetryNonce(0);
  }, [viewerSessionKey]);

  useEffect(() => {
    rotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (normalizedModelCandidates.length === 0) {
      setErrorType("model");
      setErrorMessage("モデルデータを確認できませんでした。");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorType(null);
    setErrorMessage(null);
    const initialWidth = mount.clientWidth;
    const initialHeight = mount.clientHeight;
    if (initialWidth <= 0 || initialHeight <= 0) {
      let waitFrame = 0;
      let frameId = 0;
      console.warn("[CharacterViewer] init deferred due to zero-sized viewport", {
        characterId,
        width: initialWidth,
        height: initialHeight,
      });
      const waitForReadyViewport = () => {
        waitFrame += 1;
        if (!mountRef.current) return;
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        if (width > 0 && height > 0) {
          console.info("[CharacterViewer] viewport became ready", { characterId, width, height });
          setReloadKey((value) => value + 1);
          return;
        }
        if (waitFrame >= MAX_WAIT_FRAMES_FOR_VIEWPORT_READY) {
          console.warn("[CharacterViewer] viewport ready wait reached frame limit", {
            characterId,
            width,
            height,
            waitFrame,
          });
          setErrorType("model");
          setErrorMessage("表示領域の準備に時間がかかっています。再試行してください。");
          setStatus("error");
          return;
        }
        frameId = requestAnimationFrame(waitForReadyViewport);
      };
      frameId = requestAnimationFrame(waitForReadyViewport);
      return () => {
        cancelAnimationFrame(frameId);
      };
    }
    const width = initialWidth;
    const height = initialHeight;
    console.info("[CharacterViewer] init viewport", { characterId, width, height });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG_COLOR);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 500);
    camera.position.set(0, 1.2, 3.4);
    cameraInstanceRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (error) {
      console.error("[CharacterViewer] WebGL renderer init failed", error);
      setErrorType("webgl");
      setErrorMessage("この端末では3D表示に対応していない可能性があります。");
      setStatus("error");
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(SCENE_BG_COLOR, 1);
    mount.appendChild(renderer.domElement);

    addViewerLights(scene);
    const controls = createViewerControls(camera, renderer.domElement);
    controlsInstanceRef.current = controls;

    let cancelled = false;
    let postLoadRefitFrame = 0;

    const fitAndCenterObject = (
      object: THREE.Object3D,
      reason: "initial" | "post-load" | "resize",
    ) => {
      const activeCamera = cameraInstanceRef.current;
      const activeControls = controlsInstanceRef.current;
      if (!activeCamera || !activeControls) return;

      setZoom(1);
      const { distance, scale, centeredSize } = fitObjectToView({
        object, camera: activeCamera, controls: activeControls,
        baseTransform: {
          position: basePositionRef.current,
          quaternion: baseQuaternionRef.current,
          scale: baseScaleVectorRef.current,
          restore: hasBaseTransformRef.current,
        },
        profileOffset: profileOffsetRef.current,
        minDistance: reason === "post-load" ? initialCameraDistanceRef.current : 0,
      });
      baseScaleRef.current = scale;
      if (reason !== "post-load") initialCameraDistanceRef.current = distance;
      console.info("[CharacterViewer] fit and center complete", {
        characterId,
        reason,
        cameraDistance: distance,
        bounds: {
          x: centeredSize.x,
          y: centeredSize.y,
          z: centeredSize.z,
        },
      });
    };

    const addModel = ({
      object,
      modelUrl,
      mtlUrl,
      stage,
    }: ModelLoadSuccess) => {
      if (cancelled) return;
      console.info("[CharacterViewer] candidate load succeeded", {
        characterId,
        stage,
        modelUrl,
        mtlUrl,
      });
      applyLegacyMeshFixes(object, renderProfile);
      const profileOffset = applyRenderProfile(object, renderProfile);
      profileOffsetRef.current = disableProfilePositionOffset ? new THREE.Vector3() : profileOffset;
      basePositionRef.current.copy(object.position);
      baseQuaternionRef.current.copy(object.quaternion);
      baseScaleVectorRef.current.copy(object.scale);
      hasBaseTransformRef.current = true;
      fitAndCenterObject(object, "initial");
      initialObjectRotationRef.current = object.rotation.clone();
      objectRef.current = object;
      scene.add(object);
      postLoadRefitFrame = requestAnimationFrame(() => {
        if (cancelled || !objectRef.current) return;
        fitAndCenterObject(objectRef.current, "post-load");
      });
      setStatus("ready");
    };

    loadModelFromCandidates(
      normalizedModelCandidates,
      normalizedMtlCandidates,
      Math.max(0, Math.floor(candidateRetryCount)),
    )
      .then((payload) => addModel(payload))
      .catch((error) => {
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
        if (cancelled) return;

        const normalizedAutoRetryCount = Math.max(0, Math.floor(autoRetryCount));
        const canAutoRetry =
          normalizedAutoRetryCount > 0 &&
          autoRetriedSessionKeyRef.current !== viewerSessionKey &&
          autoRetryNonce < normalizedAutoRetryCount;
        if (canAutoRetry) {
          autoRetriedSessionKeyRef.current = viewerSessionKey;
          setAutoRetryNonce((value) => value + 1);
          return;
        }

        setErrorType("model");
        setErrorMessage("読み込みに時間がかかっています。時間をおいて再試行してください。");
        setStatus("error");
      });

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (rotatingRef.current && objectRef.current) {
        objectRef.current.rotation.y += 0.01;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || width;
      const h = mountRef.current.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      console.info("[CharacterViewer] viewport resized", { characterId, width: w, height: h });
      if (objectRef.current) {
        fitAndCenterObject(objectRef.current, "resize");
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(mount);
    } else {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (!resizeObserver) {
        window.removeEventListener("resize", handleResize);
      }
      cancelAnimationFrame(postLoadRefitFrame);
      cancelAnimationFrame(frame);
      controls.dispose();
      renderer.dispose();
      controlsInstanceRef.current = null;
      cameraInstanceRef.current = null;
      profileOffsetRef.current = new THREE.Vector3();
      hasBaseTransformRef.current = false;
      basePositionRef.current = new THREE.Vector3();
      baseQuaternionRef.current = new THREE.Quaternion();
      baseScaleVectorRef.current = new THREE.Vector3(1, 1, 1);
      if (objectRef.current) {
        scene.remove(objectRef.current);
        objectRef.current = null;
      }
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- candidatesKey は normalizedModel/MtlCandidates の値ベースのキー
  }, [
    characterId,
    candidatesKey,
    reloadKey,
    autoRetryNonce,
    viewerSessionKey,
    renderProfile,
    disableProfilePositionOffset,
    candidateRetryCount,
    autoRetryCount,
  ]);

  /**
   * モデルスケールを変更する。
   *
   * @param nextZoom - 変更後倍率
   * @returns なし
   * @example
   * applyScale(1.2);
   */
  const applyScale = (nextZoom: number) => {
    if (!objectRef.current) return;
    const clampedZoom = Math.min(Math.max(nextZoom, 0.6), 2.8);
    objectRef.current.scale.setScalar(baseScaleRef.current * clampedZoom);
    setZoom(clampedZoom);
  };

  const handleScaleUp = () => applyScale(zoom * 1.15);
  const handleScaleDown = () => applyScale(zoom * 0.87);
  const handleRetry = () => {
    autoRetriedSessionKeyRef.current = null;
    setAutoRetryNonce(0);
    setReloadKey((value) => value + 1);
  };

  /**
   * カメラ・ズーム・回転を初期正面位置にリセットし、自動回転を停止する。
   *
   * @returns なし
   * @example
   * handleReset();
   */
  const handleReset = () => {
    if (!objectRef.current || !cameraInstanceRef.current || !controlsInstanceRef.current) return;
    const initialRot = initialObjectRotationRef.current;
    objectRef.current.rotation.set(initialRot.x, initialRot.y, initialRot.z);
    objectRef.current.scale.setScalar(baseScaleRef.current);
    setZoom(1);
    const dist = initialCameraDistanceRef.current;
    cameraInstanceRef.current.position.set(0, dist * 0.16, dist);
    controlsInstanceRef.current.target.set(0, 0, 0);
    controlsInstanceRef.current.update();
    rotatingRef.current = false;
    setIsRotating(false);
  };

  /**
   * モデル自動回転をトグルする。
   *
   * @returns 切り替え後の状態
   * @example
   * const rotating = toggleRotation();
   */
  const toggleRotation = () => {
    const next = !rotatingRef.current;
    rotatingRef.current = next;
    setIsRotating(next);
    return next;
  };

  useImperativeHandle(ref, () => ({
    scaleUp: handleScaleUp,
    scaleDown: handleScaleDown,
    toggleRotation,
    resetView: handleReset,
  }));

  const renderOverlayControls = controlsPlacement === "overlay" || controlsPlacement === "bottom";

  return (
    <div
      className={`relative h-full min-h-[16rem] w-full overflow-hidden rounded-xl bg-[#f0f2ef] ${className}`}
    >
      <div ref={mountRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-app-surface/95 p-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-line-soft border-t-emerald-600" />
            <p className="text-xs font-medium text-app-ink-muted">
              3Dモデルを読み込み中...
            </p>
            <p className="text-[11px] text-app-ink-muted">
              しばらくお待ちください
            </p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-app-line/10 bg-app-surface/90 px-4 py-3 text-center text-xs font-medium text-app-ink/80 shadow-sm">
            <p>
              {errorType === "webgl"
                ? "この端末では3D表示を開始できませんでした"
                : "モデルを表示できませんでした"}
            </p>
            {errorMessage && (
              <p className="mt-1 text-[11px] text-app-ink-muted">{errorMessage}</p>
            )}
            {errorType === "model" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-2 gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                再試行
              </Button>
            )}
          </div>
        </div>
      )}
      {renderOverlayControls && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 ${
            controlsPlacement === "bottom" ? "" : "flex justify-end"
          }`}
        >
          <div
            className={`pointer-events-auto gap-1 bg-app-surface/85 text-app-ink shadow-lg shadow-emerald-200/50 backdrop-blur ${
              controlsPlacement === "bottom"
                ? "grid grid-cols-4 rounded-2xl p-2"
                : "flex rounded-full px-2 py-1"
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScaleDown}
              className="justify-center !px-1 [&_[data-lk-button-content-wrap]]:flex-col [&_[data-lk-button-content-wrap]]:gap-1"
            >
              <Minus className="h-3.5 w-3.5" />
              <span className="text-[11px] whitespace-nowrap">縮小</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleRotation}
              className="justify-center !px-1 [&_[data-lk-button-content-wrap]]:flex-col [&_[data-lk-button-content-wrap]]:gap-1"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span className="text-[11px] whitespace-nowrap">{isRotating ? "停止" : "回転"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScaleUp}
              className="justify-center !px-1 [&_[data-lk-button-content-wrap]]:flex-col [&_[data-lk-button-content-wrap]]:gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-[11px] whitespace-nowrap">拡大</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="justify-center !px-1 [&_[data-lk-button-content-wrap]]:flex-col [&_[data-lk-button-content-wrap]]:gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-[11px] whitespace-nowrap">リセット</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
