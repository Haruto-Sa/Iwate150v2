import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * ビューア共通の4灯を既存の色・強度・位置で追加する。
 * @param scene - 表示シーン
 * @returns なし
 * @example addViewerLights(scene);
 */
export function addViewerLights(scene: THREE.Scene): void {
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
}

/**
 * 中央を注視する回転操作を既存の設定で作る。
 * @param camera - 操作対象カメラ
 * @param element - 描画先Canvas
 * @returns cleanup時にdisposeする操作インスタンス
 * @example const controls = createViewerControls(camera, renderer.domElement);
 */
export function createViewerControls(camera: THREE.PerspectiveCamera, element: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.target.set(0, 0, 0);
  return controls;
}
