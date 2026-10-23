import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMERA_FACE_TIMEOUT_MS, createCameraFaceWorker } from "./cameraFaceWorker";

let worker: {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  onmessage: (event: { data: unknown }) => void;
  onerror: () => void;
};

beforeEach(() => {
  vi.useFakeTimers();
  worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: () => undefined,
    onerror: () => undefined,
  };
  vi.stubGlobal("Worker", vi.fn(function () { return worker; }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

/**
 * 初期化応答を返すテスト用Workerを作る。
 * @returns 初期化済みの検出器
 * @example const tracker = await readyTracker();
 */
async function readyTracker() {
  const ready = createCameraFaceWorker("/mediapipe/face_mesh");
  worker.onmessage({ data: { type: "ready" } });
  return ready;
}

describe("camera face worker", () => {
  it("terminates a worker that never initializes", async () => {
    const ready = createCameraFaceWorker("/mediapipe/face_mesh");
    const assertion = expect(ready).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(CAMERA_FACE_TIMEOUT_MS);
    await assertion;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("transfers one frame and returns only landmarks", async () => {
    const tracker = await readyTracker();
    const bitmap = { close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const listener = vi.fn();
    tracker.onResults(listener);
    const response = tracker.send({ image: document.createElement("video") });
    await vi.advanceTimersByTimeAsync(0);
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "frame", image: bitmap }, [bitmap]);
    expect(tracker.send({ image: document.createElement("video") })).toBe(response);
    worker.onmessage({ data: { type: "result", multiFaceLandmarks: [[{ x: 0.5, y: 0.4, z: 0 }]] } });
    await response;
    expect(listener).toHaveBeenCalledWith({ multiFaceLandmarks: [[{ x: 0.5, y: 0.4, z: 0 }]] });
    expect(vi.getTimerCount()).toBe(0);
    await tracker.close();
  });

  it("includes bitmap creation in the deadline and closes a late bitmap", async () => {
    const tracker = await readyTracker();
    let resolveBitmap!: (bitmap: unknown) => void;
    vi.stubGlobal("createImageBitmap", vi.fn().mockImplementation(() => new Promise((resolve) => { resolveBitmap = resolve; })));
    const response = tracker.send({ image: document.createElement("video") });
    const assertion = expect(response).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(CAMERA_FACE_TIMEOUT_MS);
    await assertion;
    const bitmap = { close: vi.fn() };
    resolveBitmap(bitmap);
    await vi.advanceTimersByTimeAsync(0);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });

  it("rejects an in-flight frame when closed and ignores late results", async () => {
    const tracker = await readyTracker();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close: vi.fn() }));
    const listener = vi.fn();
    tracker.onResults(listener);
    const response = tracker.send({ image: document.createElement("video") });
    const assertion = expect(response).rejects.toThrow("closed");
    await tracker.close();
    await assertion;
    worker.onmessage({ data: { type: "result", multiFaceLandmarks: [] } });
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not deliver a previous page's pending frame to a new subscriber", async () => {
    const tracker = await readyTracker();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close: vi.fn() }));
    const oldListener = vi.fn();
    const newListener = vi.fn();
    tracker.onResults(oldListener);
    const response = tracker.send({ image: document.createElement("video") });
    tracker.onResults(newListener);
    expect(tracker.send({ image: document.createElement("video") })).toBe(response);
    await vi.advanceTimersByTimeAsync(0);
    worker.onmessage({ data: { type: "result", multiFaceLandmarks: [] } });
    await response;
    expect(oldListener).not.toHaveBeenCalled();
    expect(newListener).not.toHaveBeenCalled();
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    await tracker.close();
  });

  it("preserves the failing stage and bounded worker error for diagnosis", async () => {
    const tracker = await readyTracker();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close: vi.fn() }));
    const response = tracker.send({ image: document.createElement("video") });
    const assertion = expect(response).rejects.toThrow("Face inference failed (copy-frame): TypeError: canvas unavailable");
    await vi.advanceTimersByTimeAsync(0);
    worker.onmessage({ data: { type: "error", stage: "copy-frame", message: "TypeError: canvas unavailable" } });
    await assertion;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("surfaces worker errors and terminates the failed worker", async () => {
    const ready = createCameraFaceWorker("/mediapipe/face_mesh");
    const assertion = expect(ready).rejects.toThrow("failed");
    worker.onerror();
    await assertion;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
