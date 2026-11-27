import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { observeViewerResize, startViewerAnimation } from "./characterRuntime";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("ビューア描画のライフサイクル", () => {
  it("即時描画と次フレームで最新のモデル・回転状態を読み、最後の予約を停止する", () => {
    const queued = new Map<number, FrameRequestCallback>();
    let sequence = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      queued.set(++sequence, callback);
      return sequence;
    }));
    const cancel = vi.fn((id: number) => { queued.delete(id); });
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const order: string[] = [];
    const render = vi.fn(() => { order.push("render"); });
    const update = vi.fn(() => { order.push("controls"); });
    const first = new THREE.Object3D();
    const objectRef = { current: first as THREE.Object3D | null };
    const rotatingRef = { current: true };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const stop = startViewerAnimation({ scene, camera, objectRef, rotatingRef,
      renderer: { render } as unknown as THREE.WebGLRenderer,
      controls: { update } as unknown as OrbitControls });
    expect(first.rotation.y).toBe(0.01);
    expect(order).toEqual(["controls", "render"]);
    expect(render).toHaveBeenCalledWith(scene, camera);
    rotatingRef.current = false;
    queued.get(1)!(0);
    expect(first.rotation.y).toBe(0.01);
    const second = new THREE.Object3D();
    objectRef.current = second;
    rotatingRef.current = true;
    queued.get(2)!(0);
    expect(second.rotation.y).toBe(0.01);
    expect(first.rotation.y).toBe(0.01);
    stop();
    expect(cancel).toHaveBeenCalledWith(3);
    expect(queued.has(3)).toBe(false);
  });

  it.each([true, false])("ResizeObserver対応=%sで寸法更新・再fit・監視解除を行う", supported => {
    let callback: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", supported ? vi.fn(function (listener: ResizeObserverCallback) {
      callback = listener;
      return { observe, disconnect };
    }) : undefined);
    const mount = document.createElement("div");
    let width = 300;
    let height = 200;
    Object.defineProperties(mount, {
      clientWidth: { get: () => width }, clientHeight: { get: () => height },
    });
    const mountRef = { current: mount as HTMLDivElement | null };
    const camera = new THREE.PerspectiveCamera();
    const projection = vi.spyOn(camera, "updateProjectionMatrix");
    const order: string[] = [];
    const setSize = vi.fn(() => { order.push("size"); });
    const onResize = vi.fn(() => { order.push("fit"); });
    vi.spyOn(console, "info").mockImplementation(() => {});
    const stop = observeViewerResize({ mount, mountRef, camera,
      renderer: { setSize } as unknown as THREE.WebGLRenderer,
      width: 100, height: 80, onResize });
    /** 監視中のサイズ変更を通知する。@returns なし @example resize(); */
    const resize = () => supported ? callback!([], {} as ResizeObserver) : window.dispatchEvent(new Event("resize"));
    resize();
    expect(camera.aspect).toBe(1.5);
    expect(projection).toHaveBeenCalledOnce();
    expect(setSize).toHaveBeenLastCalledWith(300, 200);
    expect(order).toEqual(["size", "fit"]);
    width = 0; height = 0;
    resize();
    expect(setSize).toHaveBeenLastCalledWith(100, 80);
    mountRef.current = null;
    resize();
    expect(setSize).toHaveBeenCalledTimes(2);
    stop();
    if (supported) {
      expect(observe).toHaveBeenCalledWith(mount);
      expect(disconnect).toHaveBeenCalledOnce();
    } else {
      mountRef.current = mount;
      window.dispatchEvent(new Event("resize"));
      expect(setSize).toHaveBeenCalledTimes(2);
    }
  });
});
