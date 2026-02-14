"use client";
/* eslint-disable react-compiler/react-compiler */
"use no memo";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { Minus, Plus, RotateCw, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CharacterRenderProfile } from "@/lib/types";

export type CharacterViewerHandle = {
  scaleUp: () => void;
  scaleDown: () => void;
  toggleRotation: () => boolean;
};

type Props = {
  characterId?: string;
  modelCandidates: string[];
  mtlCandidates?: string[];
  renderProfile?: CharacterRenderProfile;
  controlsPlacement?: "overlay" | "bottom" | "none";
  className?: string;
};

type ModelLoadAttemptFailure = {
  modelUrl: string;
  mtlUrl: string | null;
  stage: "mtl+obj" | "obj";
  error: unknown;
};

type ModelLoadError = Error & {
  failures?: ModelLoadAttemptFailure[];
};

const FALLBACK_DARK_GRAY = 0x555555;
/** 白背景でも識別しやすいよう、近白色マテリアルに割り当てる色 */
const FALLBACK_LIGHT_GRAY = 0x888888;
/** シーン背景色（純白を避けて白モデルでも視認できるようにする） */
const SCENE_BG_COLOR = 0xf0f2ef;

/** 各候補URL読み込みのタイムアウト（ミリ秒） */
const LOAD_TIMEOUT_MS = 15_000;

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
 * MTL ファイルをロードする。
 *
 * @param url - MTL URL
 * @returns material creator
 * @example
 * const materials = await loadMtlMaterials("/models/a.mtl");
 */
function loadMtlMaterials(url: string): Promise<MTLLoader.MaterialCreator> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const loader = new MTLLoader();
      loader.load(url, resolve, undefined, reject);
    }),
    LOAD_TIMEOUT_MS,
    `MTL ${url}`,
  );
}

/**
 * OBJ ファイルをロードする。
 *
 * @param modelUrl - OBJ URL
 * @param materials - 事前ロード済み MTL
 * @returns OBJ group
 * @example
 * const obj = await loadObjModel("/models/a.obj", materials);
 */
function loadObjModel(
  modelUrl: string,
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
    LOAD_TIMEOUT_MS,
    `OBJ ${modelUrl}`,
  );
}

/**
 * モデル候補を順に試行して最初に読める組み合わせを返す。
 *
 * @param modelCandidates - OBJ候補
 * @param mtlCandidates - MTL候補
 * @returns 読み込み済みオブジェクト
 * @example
 * const object = await loadModelFromCandidates(models, mtls);
 */
async function loadModelFromCandidates(
  modelCandidates: string[],
  mtlCandidates: string[]
): Promise<THREE.Group> {
  let lastError: unknown = null;
  const failures: ModelLoadAttemptFailure[] = [];

  for (const modelUrl of modelCandidates) {
    if (mtlCandidates.length > 0) {
      for (const mtlUrl of mtlCandidates) {
        try {
          const materials = await loadMtlMaterials(mtlUrl);
          return await loadObjModel(modelUrl, materials);
        } catch (error) {
          lastError = error;
          failures.push({ modelUrl, mtlUrl, stage: "mtl+obj", error });
          console.warn("[CharacterViewer] mtl+obj load failed", { modelUrl, mtlUrl, error });
        }
      }
    }

    try {
      return await loadObjModel(modelUrl);
    } catch (error) {
      lastError = error;
      failures.push({ modelUrl, mtlUrl: null, stage: "obj", error });
      console.warn("[CharacterViewer] obj load failed", { modelUrl, error });
    }
  }

  const modelError = new Error("No valid model candidate") as ModelLoadError;
  modelError.cause = lastError ?? undefined;
  modelError.failures = failures;
  throw modelError;
}

/**
 * モデルURLを短い表示用文字列へ整形する。
 *
 * @param url - 対象URL
 * @returns 表示用テキスト
 * @example
 * formatCandidateLabel("https://example.com/storage/v1/object/public/iwate150data/models/a.obj");
 */
function formatCandidateLabel(url: string | null): string {
  if (!url) return "-";
  try {
    const parsed = new URL(url);
    const compact = `${parsed.hostname}${parsed.pathname}`;
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  } catch {
    return url.length > 120 ? `${url.slice(0, 117)}...` : url;
  }
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
  const alphaTest = profile?.materialAlphaTest ?? 0.1;
  const transparent = profile?.transparent ?? false;
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
          depthWrite?: boolean;
          depthTest?: boolean;
        };
        const hasMap = Boolean(typed.map);
        const hasColor = Boolean(typed.color);
        const colorLuma = hasColor && typed.color
          ? typed.color.r * 0.299 + typed.color.g * 0.587 + typed.color.b * 0.114
          : 0;
        if (forceDoubleSide) material.side = THREE.DoubleSide;
        if (hasColor && typed.color && !hasMap && colorLuma < 0.05) {
          // 近黒色 → ダークグレーに変換（背景色との区別）
          typed.color.setHex(FALLBACK_DARK_GRAY);
        } else if (hasColor && typed.color && !hasMap && colorLuma > 0.95) {
          // 近白色 → ライトグレーに変換（MTL マテリアル名不一致時のデフォルト白対策）
          typed.color.setHex(FALLBACK_LIGHT_GRAY);
        } else if (!hasColor && !hasMap && typed.color) {
          typed.color.setHex(FALLBACK_DARK_GRAY);
        }
        if ("transparent" in material) material.transparent = transparent && hasMap;
        if ("alphaTest" in material) material.alphaTest = material.transparent ? alphaTest : 0;
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
 * @param baseScaleRef - 基準スケール参照
 * @returns なし
 * @example
 * applyRenderProfile(object, profile, baseScaleRef);
 */
function applyRenderProfile(
  object: THREE.Object3D,
  profile: CharacterRenderProfile | undefined,
  baseScaleRef: { current: number }
): void {
  if (!profile) return;

  const scaleMultiplier = profile.scaleMultiplier ?? 1;
  if (scaleMultiplier !== 1) {
    object.scale.multiplyScalar(scaleMultiplier);
    baseScaleRef.current *= scaleMultiplier;
  }

  if (profile.rotation) {
    object.rotation.x += profile.rotation.x ?? 0;
    object.rotation.y += profile.rotation.y ?? 0;
    object.rotation.z += profile.rotation.z ?? 0;
  }

  if (profile.positionOffset) {
    object.position.x += profile.positionOffset.x ?? 0;
    object.position.y += profile.positionOffset.y ?? 0;
    object.position.z += profile.positionOffset.z ?? 0;
  }
}

export const CharacterViewer = forwardRef<CharacterViewerHandle, Props>(function CharacterViewer(
  {
    characterId,
    modelCandidates,
    mtlCandidates = [],
    renderProfile,
    controlsPlacement = "overlay",
    className = "",
  }: Props,
  ref
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const baseScaleRef = useRef(1);
  const rotatingRef = useRef(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isRotating, setIsRotating] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [failedModelCandidate, setFailedModelCandidate] = useState<string | null>(null);
  const [failedMtlCandidate, setFailedMtlCandidate] = useState<string | null>(null);

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

  useEffect(() => {
    rotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    if (!mountRef.current) return;
    if (normalizedModelCandidates.length === 0) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    setFailedModelCandidate(null);
    setFailedMtlCandidate(null);
    const width = mountRef.current.clientWidth || 320;
    const height = mountRef.current.clientHeight || 220;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG_COLOR);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 500);
    camera.position.set(0, 1.2, 3.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
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

    let cancelled = false;

    const fitAndCenterObject = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = 3.2;
      const fittedScale = targetSize / maxDim;
      baseScaleRef.current = fittedScale;
      setZoom(1);
      object.scale.setScalar(fittedScale);

      box.setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      const fittedSize = box.getSize(new THREE.Vector3());
      const fittedMax = Math.max(fittedSize.x, fittedSize.y, fittedSize.z) || 1;

      const distance = Math.max(3.8, fittedMax * 2.2);
      camera.position.set(0, distance * 0.16, distance);
      controls.target.set(0, 0, 0);
      controls.minDistance = distance * 0.55;
      controls.maxDistance = distance * 3;
      camera.lookAt(0, 0, 0);
    };

    const addModel = (object: THREE.Object3D) => {
      if (cancelled) return;
      applyLegacyMeshFixes(object, renderProfile);
      fitAndCenterObject(object);
      applyRenderProfile(object, renderProfile, baseScaleRef);
      objectRef.current = object;
      scene.add(object);

      // デバッグ: メッシュ数とマテリアル色をログ出力
      let meshCount = 0;
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          meshCount++;
          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            const typed = mat as THREE.Material & { color?: THREE.Color };
            if (typed.color) {
              console.info(
                `[CharacterViewer] mesh=${mesh.name || "(unnamed)"} color=#${typed.color.getHexString()} type=${mat.type}`
              );
            }
          });
        }
      });
      console.info(`[CharacterViewer] model added: ${meshCount} meshes, id=${characterId}`);

      setStatus("ready");
    };

    loadModelFromCandidates(normalizedModelCandidates, normalizedMtlCandidates)
      .then((object) => addModel(object))
      .catch((error) => {
        const errorWithMeta = error as ModelLoadError;
        const failures = errorWithMeta.failures ?? [];
        const failedCandidate = failures.length > 0 ? failures[failures.length - 1] : null;
        console.warn("[CharacterViewer] all candidates failed", { characterId, error, failures });
        if (!cancelled) {
          setFailedModelCandidate(failedCandidate?.modelUrl ?? normalizedModelCandidates[0] ?? null);
          setFailedMtlCandidate(failedCandidate?.mtlUrl ?? normalizedMtlCandidates[0] ?? null);
          setStatus("error");
        }
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
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frame);
      controls.dispose();
      renderer.dispose();
      if (objectRef.current) {
        scene.remove(objectRef.current);
        objectRef.current = null;
      }
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- candidatesKey は normalizedModel/MtlCandidates の値ベースのキー
  }, [characterId, candidatesKey, reloadKey, renderProfile]);

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
  }));

  const renderOverlayControls = controlsPlacement === "overlay" || controlsPlacement === "bottom";

  return (
    <div
      className={`relative h-full min-h-[16rem] w-full overflow-hidden rounded-xl bg-[#f0f2ef] ${className}`}
    >
      <div ref={mountRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-emerald-900/10 bg-white/90 px-4 py-2 text-center text-xs font-medium text-emerald-900/80 shadow-sm">
            <p>{status === "loading" ? "モデルを読み込み中..." : "モデルを表示できませんでした"}</p>
            {status === "error" && (
              <>
                <p className="mt-1 text-[11px] text-emerald-900/70">
                  model: {formatCandidateLabel(failedModelCandidate)}
                </p>
                {failedMtlCandidate && (
                  <p className="mt-1 text-[11px] text-emerald-900/70">
                    mtl: {formatCandidateLabel(failedMtlCandidate)}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-2 gap-1"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  再試行
                </Button>
              </>
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
            className={`pointer-events-auto gap-2 bg-white/85 text-emerald-900 shadow-lg shadow-emerald-200/50 backdrop-blur ${
              controlsPlacement === "bottom"
                ? "grid grid-cols-3 rounded-2xl p-2"
                : "flex rounded-full px-2 py-1"
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScaleDown}
              className="justify-center gap-1 active:scale-95"
            >
              <Minus className="h-4 w-4" />
              縮小
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleRotation}
              className="justify-center gap-1 active:scale-95"
            >
              <RotateCw className="h-4 w-4" />
              {isRotating ? "停止" : "回転"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScaleUp}
              className="justify-center gap-1 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              拡大
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
