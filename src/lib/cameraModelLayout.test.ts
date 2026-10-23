import { expect, it } from "vitest";
import * as THREE from "three";
import { layoutCameraModels, type CameraRect } from "./cameraModelLayout";

/**
 * 2矩形の重なり面積を測る。
 * @param a - 第1矩形
 * @param b - 第2矩形
 * @returns 重なり面積
 * @example overlap(face, model);
 */
function overlap(a: CameraRect, b: CameraRect): number {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

it("顔が上端にある場合も全体を表示し、顔の上へ押し戻さない", () => {
  const face = { x: 0.35, y: 0.02, width: 0.3, height: 0.4 };
  const [slot] = layoutCameraModels(face, [{width:0.3,height:0.4}]);
  expect(slot).not.toBeNull();
  expect(slot!.scale).toBe(1);
  expect(slot!.y).toBeGreaterThanOrEqual(0.02);
  expect(overlap(face, slot!)).toBe(0);
});

it("縦横の画面・顔の端・1〜5体で、モデル同士と顔が重ならず透視投影後も収まる", () => {
  for (const aspect of [0.5, 4 / 3, 2.16]) {
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.z = 5;
    camera.updateMatrixWorld();
    const height = 10 * Math.tan(Math.PI / 8);
    const width = height * aspect;
    const model = {x:0.6,y:1,z:0.7};
    const depth = model.z / 10;
    const size = { width:(model.x / width + depth) / (1 - depth), height:(model.y / height + depth) / (1 - depth) };
    for (const x of [-0.15, 0, 0.3, 0.7]) for (const y of [-0.1, 0, 0.3, 0.7]) {
      const face = { x, y, width:0.35,height:0.45 };
      for (let count = 1; count <= 5; count++) {
        const slots = layoutCameraModels(face, Array.from({length:count}, () => size));
        expect(slots.every(Boolean)).toBe(true);
        slots.forEach((slot, index) => {
          expect(overlap(face, slot!)).toBeLessThan(1e-12);
          for (const other of slots.slice(0,index)) expect(overlap(slot!, other!)).toBeLessThan(1e-12);
          for (const dx of [-1,1]) for (const dy of [-1,1]) for (const dz of [-1,1]) {
            const vertex = new THREE.Vector3(
              (slot!.x + slot!.width / 2 - 0.5) * width + dx * model.x * slot!.scale / 2,
              -(slot!.y + slot!.height / 2 - 0.5) * height + dy * model.y * slot!.scale / 2,
              dz * model.z * slot!.scale / 2,
            ).project(camera);
            const projectedX = (vertex.x + 1) / 2;
            const projectedY = (1 - vertex.y) / 2;
            expect(projectedX).toBeGreaterThanOrEqual(slot!.x - 1e-10);
            expect(projectedX).toBeLessThanOrEqual(slot!.x + slot!.width + 1e-10);
            expect(projectedY).toBeGreaterThanOrEqual(slot!.y - 1e-10);
            expect(projectedY).toBeLessThanOrEqual(slot!.y + slot!.height + 1e-10);
            expect(Math.abs(vertex.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(vertex.y)).toBeLessThanOrEqual(1);
          }
        });
      }
    }
  }
});

it("顔が画面を覆う場合は重ねず、配置できないことを返す", () => {
  expect(layoutCameraModels({x:0,y:0,width:1,height:1}, [{width:0.2,height:0.3}])).toEqual([null]);
});


it("左右が同じ条件なら顔の微小な移動で配置側が反転しない", () => {
  for (const center of [0.49, 0.5, 0.51, 0.50000001, 0.49999999]) {
    const face = { x:center - 0.15, y:0.02, width:0.3, height:0.4 };
    const [slot] = layoutCameraModels(face, [{width:0.25,height:0.3}]);
    expect(slot!.x + slot!.width).toBeLessThan(face.x);
  }
});
