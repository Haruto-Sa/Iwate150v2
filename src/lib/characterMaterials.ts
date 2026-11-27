import * as THREE from "three";
import type { CharacterRenderProfile } from "./types";

const FALLBACK_DARK_GRAY = 0x555555;
/** 白背景でも識別しやすいよう、近白色マテリアルに割り当てる色 */
const FALLBACK_LIGHT_GRAY = 0x888888;

/**
 * モデルへ legacy 互換のメッシュ補正を適用する。
 *
 * @param object - 3Dオブジェクト
 * @param profile - モデル表示プロファイル
 * @returns なし
 * @example
 * applyLegacyMeshFixes(object, profile);
 */
export function applyLegacyMeshFixes(
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
        // Textureは画像の到着前にも存在するため、読込順で材質色を変更しない。
        const hasMap = Boolean(typed.map);
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

