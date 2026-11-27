import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { drawCameraFrame, getCameraFaceBounds, initializeCameraScene, disposeCameraScene } from "./cameraRendering";

const rendererMethods = vi.hoisted(() => ({ setSize: vi.fn(), setPixelRatio: vi.fn(), setClearColor: vi.fn() }));
vi.mock("three", async (importOriginal) => ({
  ...await importOriginal<typeof import("three")>(),
  WebGLRenderer: vi.fn(function () { return rendererMethods; }),
}));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

/** テスト用映像と描画呼出しの記録を用意する。@returns 合成引数と呼出し記録 @example const fixture = frameFixture(); */
function frameFixture() {
  const calls: string[] = [];
  const ctx = {
    save: vi.fn(() => calls.push("save")), restore: vi.fn(() => calls.push("restore")),
    translate: vi.fn(() => calls.push("translate")), scale: vi.fn(() => calls.push("scale")),
    drawImage: vi.fn(() => calls.push("draw")),
  };
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const video = document.createElement("video");
  Object.defineProperties(video, {
    readyState: { value: HTMLMediaElement.HAVE_CURRENT_DATA, configurable: true },
    videoWidth: { value: 1280 }, videoHeight: { value: 720 },
    clientWidth: { value: 360 }, clientHeight: { value: 640 },
  });
  const params = {
    video, canvas, resize: true, mirrored: true, hasSelectedModels: true,
    overlayCanvas: document.createElement("canvas"), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    renderer: { render: vi.fn(() => calls.push("render")) } as unknown as THREE.WebGLRenderer,
  };
  return { params, ctx, calls };
}

describe("撮影用の描画処理", () => {
  it.each([true, false])("鏡像=%sでもモデルは映像の変換を解除した後に重ねる", mirrored => {
    const { params, ctx, calls } = frameFixture();
    drawCameraFrame({ ...params, mirrored });
    expect([params.canvas.width, params.canvas.height]).toEqual([405, 720]);
    expect(ctx.drawImage.mock.calls[0]).toEqual([params.video, 438, 0, 405, 720, 0, 0, 405, 720]);
    expect(ctx.drawImage.mock.calls[1]).toEqual([params.overlayCanvas, 0, 0, 405, 720]);
    expect(calls).toEqual(mirrored ? ["save", "translate", "scale", "draw", "restore", "render", "draw"] : ["draw", "render", "draw"]);
    if (mirrored) {
      expect(ctx.translate).toHaveBeenCalledWith(405, 0);
      expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    }
  });

  it("動画の上限を初回に適用し、以降は既存の出力寸法で切り抜く", () => {
    const { params, ctx } = frameFixture();
    drawCameraFrame({ ...params, maxEdge: 640, hasSelectedModels: false });
    expect([params.canvas.width, params.canvas.height]).toEqual([360, 640]);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(params.renderer.render).not.toHaveBeenCalled();
    params.canvas.width = 640; params.canvas.height = 360;
    drawCameraFrame({ ...params, resize: false, hasSelectedModels: false });
    expect([params.canvas.width, params.canvas.height]).toEqual([640, 360]);
    expect(ctx.drawImage.mock.calls.at(-1)).toEqual([params.video, 0, 0, 1280, 720, 0, 0, 640, 360]);
  });

  it("使える映像や描画先がない場合は保存用の描画を進めない", () => {
    const { params, ctx } = frameFixture();
    expect(() => drawCameraFrame({ ...params, video: null })).toThrow("Camera frame unavailable");
    Object.defineProperty(params.video, "readyState", { value: 0 });
    expect(() => drawCameraFrame(params)).toThrow("Camera frame unavailable");
    expect(ctx.drawImage).not.toHaveBeenCalled();
    Object.defineProperty(params.video, "readyState", { value: HTMLMediaElement.HAVE_CURRENT_DATA });
    vi.spyOn(params.canvas, "getContext").mockReturnValue(null);
    expect(() => drawCameraFrame(params)).toThrow("Canvas unavailable");
  });

  it("カメラの向きに従って顔枠を反転し、画面外の座標を切り詰める", () => {
    const points = [{ x: -0.1, y: -0.2 }, { x: 0.4, y: 1.2 }];
    expect(getCameraFaceBounds(points, false)).toEqual({ x: 0, y: 0, width: 0.4, height: 1 });
    expect(getCameraFaceBounds(points, true)).toEqual({ x: 0.6, y: 0, width: 0.4, height: 1 });
  });

  it("表示先が準備できてからシーンを一度だけ生成する", () => {
    const refs = { overlayCanvasRef: { current: null as HTMLCanvasElement | null }, sceneRef: { current: null as THREE.Scene | null }, cameraRef: { current: null as THREE.PerspectiveCamera | null }, rendererRef: { current: null as THREE.WebGLRenderer | null } };
    initializeCameraScene(refs);
    expect(THREE.WebGLRenderer).not.toHaveBeenCalled();
    refs.overlayCanvasRef.current = document.createElement("canvas");
    initializeCameraScene(refs);
    const scene = refs.sceneRef.current;
    initializeCameraScene(refs);
    expect(THREE.WebGLRenderer).toHaveBeenCalledTimes(1);
    expect(refs.sceneRef.current).toBe(scene);
    expect(scene?.children).toHaveLength(2);
    expect(rendererMethods.setSize).toHaveBeenCalledWith(640, 480);
    expect(refs.cameraRef.current?.position.z).toBe(5);
  });

  it("終了時点の資源をシーン・描画器・コンテキストの順で解放する", () => {
    const calls: string[] = [];
    const refs = {
      sceneRef: { current: null as THREE.Scene | null },
      rendererRef: { current: null as THREE.WebGLRenderer | null },
    };
    disposeCameraScene(refs);
    refs.sceneRef.current = new THREE.Scene();
    vi.spyOn(refs.sceneRef.current, "clear").mockImplementation(() => { calls.push("clear"); return refs.sceneRef.current!; });
    refs.rendererRef.current = {
      dispose: () => calls.push("dispose"), forceContextLoss: () => calls.push("context-loss"),
    } as unknown as THREE.WebGLRenderer;
    disposeCameraScene(refs);
    expect(calls).toEqual(["clear", "dispose", "context-loss"]);
  });

});
