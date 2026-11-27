import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { fitObjectToView } from "./characterViewFit";

/** @returns 変位・回転・不均一スケールを持つモデル @example const params = fixture(); */
function fixture() {
  const object = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1));
  object.position.set(3, -2, 5);
  object.rotation.set(0.2, 0.5, -0.1);
  object.scale.set(2, 1, 0.5);
  return {
    object,
    camera: new THREE.PerspectiveCamera(38, 390 / 500, 0.01, 500),
    controls: { target: new THREE.Vector3(), minDistance: 0, maxDistance: 0, update: vi.fn(() => false) },
    baseTransform: { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), restore: true },
    profileOffset: new THREE.Vector3(),
    minDistance: 0,
  };
}

describe("ビューアの中央寄せ", () => {
  it("変位と回転のあるモデルを中央に収め、最大寸法を維持する", () => {
    const params = fixture();
    const result = fitObjectToView(params);
    const box = new THREE.Box3().setFromObject(params.object);
    expect(box.getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-12);
    expect(Math.max(...box.getSize(new THREE.Vector3()).toArray())).toBeCloseTo(3.2, 12);
    expect(result.distance).toBeGreaterThanOrEqual(3.8);
    expect(params.camera.near).toBeGreaterThan(0);
    expect(params.camera.far).toBeGreaterThan(result.distance);
    expect(params.controls.minDistance).toBeLessThan(result.distance);
    expect(params.controls.maxDistance).toBeGreaterThan(result.distance);
  });

  it("再配置を繰り返してもスケールと位置補正が累積しない", () => {
    const params = fixture();
    params.profileOffset.set(0.1, -0.2, 0.3);
    const first = fitObjectToView(params);
    const position = params.object.position.clone();
    const scale = params.object.scale.clone();
    params.object.scale.multiplyScalar(1.5);
    params.object.rotation.y += 0.7;
    const next = fitObjectToView(params);
    expect(params.object.position.toArray()).toEqual(position.toArray());
    expect(params.object.scale.toArray()).toEqual(scale.toArray());
    expect(next.distance).toBe(first.distance);
    const center = new THREE.Box3().setFromObject(params.object).getCenter(new THREE.Vector3());
    expect(center.distanceTo(params.profileOffset)).toBeLessThan(1e-12);
  });

  it("読込後の再配置では既存距離より近付かず、通常の再配置では再計算する", () => {
    const params = fixture();
    const initial = fitObjectToView(params);
    params.minDistance = initial.distance * 2;
    expect(fitObjectToView(params).distance).toBe(params.minDistance);
    params.minDistance = 0;
    expect(fitObjectToView(params).distance).toBe(initial.distance);
  });
});
