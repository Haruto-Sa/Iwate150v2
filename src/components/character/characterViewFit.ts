import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type FitParameters = {
  object: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  controls: Pick<OrbitControls, "target" | "minDistance" | "maxDistance" | "update">;
  baseTransform: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
    restore: boolean;
  };
  profileOffset: THREE.Vector3;
  minDistance: number;
};

/**
 * モデルを中央へ収め、既存の表示寸法とカメラ操作範囲を設定する。
 * @param params - モデル、カメラ、操作、補正前の変換、位置補正と最小距離
 * @returns カメラ距離、基準スケール、位置補正前の境界寸法
 * @example const fit = fitObjectToView({ object, camera, controls, baseTransform, profileOffset, minDistance: 0 });
 */
export function fitObjectToView({ object, camera, controls, baseTransform, profileOffset, minDistance }: FitParameters) {
  if (baseTransform.restore) {
    object.position.copy(baseTransform.position);
    object.quaternion.copy(baseTransform.quaternion);
    object.scale.copy(baseTransform.scale);
  }
  object.updateMatrixWorld(true);

  const initialBox = new THREE.Box3().setFromObject(object);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
  const targetSize = 3.2;
  const fittedScale = targetSize / maxDim;
  object.scale.copy(baseTransform.scale).multiplyScalar(fittedScale);

  object.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(object);
  const center = scaledBox.getCenter(new THREE.Vector3());
  object.position.sub(center);

  object.updateMatrixWorld(true);
  const centeredBox = new THREE.Box3().setFromObject(object);
  const centeredSize = centeredBox.getSize(new THREE.Vector3());
  const centeredSphere = centeredBox.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(centeredSphere.radius, 0.1);
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const distanceByFov = radius / Math.sin(fovRad / 2);
  let distance = Math.max(3.8, distanceByFov * 1.22);
  distance = Math.max(distance, minDistance);
  camera.near = Math.max(0.01, radius / 200);
  camera.far = Math.max(120, distance + radius * 24);
  camera.updateProjectionMatrix();
  camera.position.set(0, 0, distance);
  controls.target.set(0, 0, 0);
  controls.minDistance = distance * 0.55;
  controls.maxDistance = distance * 3;
  camera.lookAt(0, 0, 0);

  if (profileOffset.lengthSq() > 0) {
    object.position.add(profileOffset);
    object.updateMatrixWorld(true);
  }
  controls.update();
  return { distance, scale: object.scale.x, centeredSize };
}
