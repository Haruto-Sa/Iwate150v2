import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CAMERA_MODEL_TIMEOUT_MS, disposeCameraModel, loadCameraModel, normalizeCameraModel } from "./cameraModel";

const triangle = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n";
const fetchAsset = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchAsset);
  vi.stubGlobal("performance", { mark: vi.fn(), clearMarks: vi.fn() });
  fetchAsset.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("OBJの受信を待たずにMTLも取得する", async () => {
  let finish!: (response: Response) => void;
  fetchAsset.mockImplementation((url) => String(url).endsWith(".obj")
    ? new Promise((resolve) => { finish = resolve; })
    : Promise.resolve(new Response("newmtl plain\nKd 1 0 0\n")));
  const pending = loadCameraModel("test", "/test.obj", "/test.mtl", new AbortController().signal);
  expect(fetchAsset.mock.calls.map(([url]) => url)).toEqual(["/test.obj", "/test.mtl"]);
  finish(new Response(triangle));
  const object = await pending;
  expect(object.children).toHaveLength(1);
  disposeCameraModel(object);
});

it("停止した通信は20秒で中止しTimeoutErrorを返す", async () => {
  vi.useFakeTimers();
  let receivedSignal!: AbortSignal;
  fetchAsset.mockImplementation((_, options) => new Promise((_, reject) => {
    receivedSignal = options!.signal!;
    receivedSignal.addEventListener("abort", () => reject(receivedSignal.reason));
  }));
  const pending = loadCameraModel("test", "/test.obj", null, new AbortController().signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(CAMERA_MODEL_TIMEOUT_MS);
  await rejected;
  expect(receivedSignal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("選択解除は並行中の両リクエストを中止する", async () => {
  const received: AbortSignal[] = [];
  fetchAsset.mockImplementation((_, options) => new Promise((_, reject) => {
    const signal = options!.signal!;
    received.push(signal);
    signal.addEventListener("abort", () => reject(signal.reason));
  }));
  const selection = new AbortController();
  const pending = loadCameraModel("test", "/test.obj", "/test.mtl", selection.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  selection.abort();
  await rejected;
  expect(received).toHaveLength(2);
  expect(received.every((signal) => signal.aborted)).toBe(true);
});

it("宣言サイズに依存せず受信が32MiBを超えたら中止する", async () => {
  let cancelled = false;
  fetchAsset.mockResolvedValue(new Response(new ReadableStream({
    start(stream) { stream.enqueue(new Uint8Array(32 * 1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  })));
  await expect(loadCameraModel("test", "/test.obj", null, new AbortController().signal)).rejects.toThrow("32MiB");
  expect(cancelled).toBe(true);
});

it("モデル内で共有するgeometry/material/textureを一度ずつ解放する", () => {
  const geometry = new THREE.BufferGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const object = new THREE.Group();
  const scene = new THREE.Scene();
  scene.add(object);
  object.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const releases = [vi.spyOn(geometry, "dispose"), vi.spyOn(material, "dispose"), vi.spyOn(texture, "dispose")];
  disposeCameraModel(object);
  for (const release of releases) expect(release).toHaveBeenCalledTimes(1);
  expect(object.parent).toBeNull();
});

it("一時的なサーバーエラーだけは同じ期限内で最大2回再試行する", async () => {
  fetchAsset.mockResolvedValueOnce(new Response("failed", { status: 503 }))
    .mockResolvedValueOnce(new Response("failed", { status: 503 }))
    .mockResolvedValueOnce(new Response(triangle));
  const object = await loadCameraModel("test", "/test.obj", null, new AbortController().signal);
  expect(fetchAsset).toHaveBeenCalledTimes(3);
  disposeCameraModel(object);
});

it("マテリアルの外部テクスチャも選択解除で通信を中止する", async () => {
  let textureSignal: AbortSignal | undefined;
  fetchAsset.mockImplementation((url, options) => {
    if (String(url).endsWith(".png")) return new Promise((_, reject) => {
      textureSignal = options!.signal!;
      textureSignal.addEventListener("abort", () => reject(textureSignal!.reason));
    });
    return Promise.resolve(new Response(String(url).endsWith(".mtl")
      ? "newmtl skin\nmap_Kd texture.png\n" : "usemtl skin\n" + triangle));
  });
  const selection = new AbortController();
  const pending = loadCameraModel("test", "/test.obj", "/test.mtl", selection.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(textureSignal).toBeDefined());
  selection.abort();
  await rejected;
  expect(textureSignal!.aborted).toBe(true);
});

it("テクスチャの取得失敗を描画準備完了として返さない", async () => {
  fetchAsset.mockImplementation((url) => Promise.resolve(String(url).endsWith(".png")
    ? new Response("missing", { status: 404 })
    : new Response(String(url).endsWith(".mtl") ? "newmtl skin\nmap_Kd texture.png\n" : "usemtl skin\n" + triangle)));
  await expect(loadCameraModel("test", "/test.obj", "/test.mtl", new AbortController().signal)).rejects.toThrow("texture failed");
});


it("原点から離れたモデルも追従位置と拡大率の変更後に中心がずれない", () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshBasicMaterial());
  mesh.geometry.translate(7, 11, -3);
  mesh.rotation.z = Math.PI / 4;
  const model = normalizeCameraModel(mesh);
  model.position.set(-1, 2, 0);
  model.scale.multiplyScalar(0.7);
  const box = new THREE.Box3().setFromObject(model);
  expect(box.getCenter(new THREE.Vector3()).distanceTo(model.position)).toBeLessThan(1e-6);
  const size = box.getSize(new THREE.Vector3());
  expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(0.7);
  disposeCameraModel(model);
});

it("元データの単位が大きくても正規化した最長辺は1になる", () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1000, 2000, 500), new THREE.MeshBasicMaterial());
  const model = normalizeCameraModel(mesh);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1);
  disposeCameraModel(model);
});
