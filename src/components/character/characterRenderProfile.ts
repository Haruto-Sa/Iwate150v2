import * as THREE from "three";
import type { CharacterRenderProfile } from "@/lib/types";

/**
 * legacy互換のモデル別チューニングを反映する。
 *
 * @param object - 3Dオブジェクト
 * @param profile - モデル表示プロファイル
 * @returns センタリング後に加算する位置オフセット
 * @example
 * const offset = applyRenderProfile(object, profile);
 */
export function applyRenderProfile(
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

