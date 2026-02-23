"use client";
/* eslint-disable react-compiler/react-compiler */
"use no memo";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
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

type ModelLoadAttemptFailure = {
  modelUrl: string;
  mtlUrl: string | null;
  stage: "mtl+obj" | "obj" | "fbx";
  error: unknown;
};

type ModelLoadSuccess = {
  object: THREE.Group;
  modelUrl: string;
  mtlUrl: string | null;
  stage: "mtl+obj" | "obj" | "fbx";
};

type ModelLoadError = Error & {
  failures?: ModelLoadAttemptFailure[];
};

type ViewerErrorType = "model" | "webgl";

const FALLBACK_DARK_GRAY = 0x555555;
/** 白背景でも識別しやすいよう、近白色マテリアルに割り当てる色 */
const FALLBACK_LIGHT_GRAY = 0x888888;
/** シーン背景色（純白を避けて白モデルでも視認できるようにする） */
const SCENE_BG_COLOR = 0xf0f2ef;
/** ローカル配信モデルの読み込みタイムアウト（ミリ秒） */
const LOCAL_LOAD_TIMEOUT_MS = 45_000;
/** リモート配信モデルの読み込みタイムアウト（ミリ秒） */
const REMOTE_LOAD_TIMEOUT_MS = 12_000;
/** 各候補URLに対するデフォルトリトライ回数 */
const DEFAULT_CANDIDATE_RETRY_COUNT = 2;
/** 読み込み失敗時のデフォルト自動再試行回数 */
const DEFAULT_AUTO_RETRY_COUNT = 1;
/** 初期化を遅延するマウントサイズ判定の待機フレーム上限（約6秒相当） */
const MAX_WAIT_FRAMES_FOR_VIEWPORT_READY = 360;

type ModelFormat = "obj" | "fbx";

/**
 * URL/パスから拡張子なしファイル名（小文字）を取り出す。
 *
 * @param url - URL またはパス
 * @returns ファイル名（拡張子なし）
 * @example
 * const stem = extractFileStem("/models/wanko1.obj?token=abc");
 */
function extractFileStem(url: string): string | null {
  const stripped = url.split("?")[0]?.split("#")[0] ?? url;
  const segment = stripped.split("/").pop();
  if (!segment) return null;
  const decoded = decodeURIComponent(segment);
  const dotIndex = decoded.lastIndexOf(".");
  const stem = dotIndex > 0 ? decoded.slice(0, dotIndex) : decoded;
  return stem.toLowerCase();
}

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
 * URL 文字列からモデル形式を推定する。
 *
 * @param modelUrl - モデルURL
 * @returns `obj` または `fbx`
 * @example
 * const format = resolveModelFormat("/models/character.fbx");
 */
function resolveModelFormat(modelUrl: string): ModelFormat {
  const stripped = modelUrl.split("?")[0]?.split("#")[0] ?? modelUrl;
  return stripped.toLowerCase().endsWith(".fbx") ? "fbx" : "obj";
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
async function loadModelFromCandidates(
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

/**
 * モデルへ legacy 互換のメッシュ補正を適用する。
 *
 * @param object - 3Dオブジェクト
 * @param profile - モデル表示プロファイル
 * @returns なし
 * @example
 * applyLegacyMeshFixes(object, profile);
 */
function applyLegacyMeshFixes(
  object: THREE.Object3D,
  profile?: CharacterRenderProfile
): void {
  const forceDoubleSide = profile?.forceDoubleSide ?? true;
  const disableFrustumCulling = profile?.disableFrustumCulling ?? true;
  const depthWrite = profile?.depthWrite ?? true;
  const depthTest = profile?.depthTest ?? true;
  const computeVertexNormals = profile?.computeVertexNormals ?? true;

  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;

    if (!mesh.material) {
      mesh.material = new THREE.MeshLambertMaterial({
        color: FALLBACK_DARK_GRAY,
        side: THREE.DoubleSide,
        transparent: false,
        alphaTest: 0,
        depthWrite,
        depthTest,
      });
    } else {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const typed = material as THREE.Material & {
          color?: THREE.Color;
          map?: THREE.Texture | null;
          transparent?: boolean;
          alphaTest?: number;
          opacity?: number;
          depthWrite?: boolean;
          depthTest?: boolean;
        };
        if (typed.map && !("image" in typed.map)) {
          typed.map = null;
        }
        const hasMap = Boolean(typed.map && typed.map.image);
        const hasColor = Boolean(typed.color);
        const colorLuma = hasColor && typed.color
          ? typed.color.r * 0.299 + typed.color.g * 0.587 + typed.color.b * 0.114
          : 0;
        if (forceDoubleSide) material.side = THREE.DoubleSide;
        if (hasColor && typed.color && !hasMap && colorLuma < 0.05) {
          // 近黒色 -> ダークグレーに変換（背景色との区別）
          typed.color.setHex(FALLBACK_DARK_GRAY);
        } else if (hasColor && typed.color && !hasMap && colorLuma > 0.95) {
          // 近白色 -> ライトグレーに変換（マテリアル不一致時の白飛び対策）
          typed.color.setHex(FALLBACK_LIGHT_GRAY);
        } else if (!hasColor && !hasMap && typed.color) {
          typed.color.setHex(FALLBACK_DARK_GRAY);
        }
        if ("transparent" in material) material.transparent = false;
        if ("alphaTest" in material) material.alphaTest = 0;
        if ("opacity" in material) material.opacity = 1;
        if ("depthWrite" in material) material.depthWrite = depthWrite;
        if ("depthTest" in material) material.depthTest = depthTest;
        material.needsUpdate = true;
      });
    }

    if (computeVertexNormals && mesh.geometry) {
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    }

    mesh.frustumCulled = !disableFrustumCulling;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
}

/**
 * legacy互換のモデル別チューニングを反映する。
 *
 * @param object - 3Dオブジェクト
 * @param profile - モデル表示プロファイル
 * @returns センタリング後に加算する位置オフセット
 * @example
 * const offset = applyRenderProfile(object, profile);
 */
function applyRenderProfile(
  object: THREE.Object3D,
  profile: CharacterRenderProfile | undefined,
): THREE.Vector3 {
  if (!profile) return new THREE.Vector3();

  const scaleMultiplier = profile.scaleMultiplier ?? 1;
  if (scaleMultiplier !== 1) {
    object.scale.multiplyScalar(scaleMultiplier);
  }

  if (profile.rotation) {
    object.rotation.x += profile.rotation.x ?? 0;
    object.rotation.y += profile.rotation.y ?? 0;
    object.rotation.z += profile.rotation.z ?? 0;
  }

  return new THREE.Vector3(
    profile.positionOffset?.x ?? 0,
    profile.positionOffset?.y ?? 0,
    profile.positionOffset?.z ?? 0,
  );
}

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
    if (!mountRef.current) return;
    if (normalizedModelCandidates.length === 0) {
      setErrorType("model");
      setErrorMessage("モデルデータを確認できませんでした。");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorType(null);
    setErrorMessage(null);
    const initialWidth = mountRef.current.clientWidth;
    const initialHeight = mountRef.current.clientHeight;
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
    mountRef.current.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0xe9edf0, 1.35);
    scene.add(light);
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(2.5, 3.5, 2);
    scene.add(directional);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-2.5, 2.2, -2);
    scene.add(fill);
    const back = new THREE.DirectionalLight(0xffffff, 0.45);
    back.position.set(0, 2.8, -3);
    scene.add(back);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);
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

      if (hasBaseTransformRef.current) {
        object.position.copy(basePositionRef.current);
        object.quaternion.copy(baseQuaternionRef.current);
        object.scale.copy(baseScaleVectorRef.current);
      }
      object.updateMatrixWorld(true);

      const initialBox = new THREE.Box3().setFromObject(object);
      const initialSize = initialBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
      const targetSize = 3.2;
      const fittedScale = targetSize / maxDim;
      setZoom(1);
      object.scale.copy(baseScaleVectorRef.current).multiplyScalar(fittedScale);
      baseScaleRef.current = object.scale.x;

      object.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(object);
      const center = scaledBox.getCenter(new THREE.Vector3());
      object.position.sub(center);

      object.updateMatrixWorld(true);
      const centeredBox = new THREE.Box3().setFromObject(object);
      const centeredSize = centeredBox.getSize(new THREE.Vector3());
      const centeredSphere = centeredBox.getBoundingSphere(new THREE.Sphere());
      const radius = Math.max(centeredSphere.radius, 0.1);
      const fovRad = THREE.MathUtils.degToRad(activeCamera.fov);
      const distanceByFov = radius / Math.sin(fovRad / 2);
      let distance = Math.max(3.8, distanceByFov * 1.22);
      if (reason === "post-load") {
        distance = Math.max(distance, initialCameraDistanceRef.current);
      } else {
        initialCameraDistanceRef.current = distance;
      }
      activeCamera.near = Math.max(0.01, radius / 200);
      activeCamera.far = Math.max(120, distance + radius * 24);
      activeCamera.updateProjectionMatrix();
      activeCamera.position.set(0, 0, distance);
      activeControls.target.set(0, 0, 0);
      activeControls.minDistance = distance * 0.55;
      activeControls.maxDistance = distance * 3;
      activeCamera.lookAt(0, 0, 0);

      if (profileOffsetRef.current.lengthSq() > 0) {
        object.position.add(profileOffsetRef.current);
        object.updateMatrixWorld(true);
      }
      activeControls.update();
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
      resizeObserver.observe(mountRef.current);
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
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
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
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
            <p className="text-xs font-medium text-emerald-900/70">
              3Dモデルを読み込み中...
            </p>
            <p className="text-[11px] text-emerald-900/45">
              しばらくお待ちください
            </p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-emerald-900/10 bg-white/90 px-4 py-3 text-center text-xs font-medium text-emerald-900/80 shadow-sm">
            <p>
              {errorType === "webgl"
                ? "この端末では3D表示を開始できませんでした"
                : "モデルを表示できませんでした"}
            </p>
            {errorMessage && (
              <p className="mt-1 text-[11px] text-emerald-900/70">{errorMessage}</p>
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
            className={`pointer-events-auto gap-1 bg-white/85 text-emerald-900 shadow-lg shadow-emerald-200/50 backdrop-blur ${
              controlsPlacement === "bottom"
                ? "grid grid-cols-4 rounded-2xl p-2"
                : "flex rounded-full px-2 py-1"
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScaleDown}
              className="justify-center gap-0.5 active:scale-95"
            >
              <Minus className="h-3.5 w-3.5" />
              <span className="text-[11px]">縮小</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleRotation}
              className="justify-center gap-0.5 active:scale-95"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span className="text-[11px]">{isRotating ? "停止" : "回転"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScaleUp}
              className="justify-center gap-0.5 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-[11px]">拡大</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="justify-center gap-0.5 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-[11px]">リセット</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
