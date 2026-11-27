import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraFaceTracker } from "@/lib/cameraFaceWorker";

const { createWorker } = vi.hoisted(() => ({ createWorker: vi.fn() }));
vi.mock("@/lib/cameraFaceWorker", () => ({ createCameraFaceWorker: createWorker }));
vi.mock("@/lib/cameraTimings", () => ({ markCameraTiming: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  createWorker.mockReset();
  vi.stubGlobal("Worker", vi.fn());
  vi.stubGlobal("OffscreenCanvas", vi.fn());
  vi.stubGlobal("createImageBitmap", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

/**
 * 破棄を観測できる顔検出器を作る。
 * @returns Worker通信を行わない検出器
 * @example const instance = tracker();
 */
function tracker(): CameraFaceTracker {
  return { send: vi.fn().mockResolvedValue(undefined), onResults: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
}

describe("FaceMesh shared lifecycle", () => {
  it("concurrent acquisition and later visits reuse one initialization", async () => {
    const instance = tracker();
    let finish!: (value: CameraFaceTracker) => void;
    createWorker.mockReturnValue(new Promise<CameraFaceTracker>(resolve => { finish = resolve; }));
    const { acquireFaceMeshInstance } = await import("./faceMesh");
    const first = acquireFaceMeshInstance();
    const second = acquireFaceMeshInstance();
    expect(createWorker).toHaveBeenCalledTimes(1);
    finish(instance);
    expect(await first).toBe(instance);
    expect(await second).toBe(instance);
    expect(await acquireFaceMeshInstance()).toBe(instance);
    expect(createWorker).toHaveBeenCalledTimes(1);
  });

  it("retries initialization after a rejection", async () => {
    const instance = tracker();
    createWorker.mockRejectedValueOnce(new Error("initialization failed")).mockResolvedValueOnce(instance);
    const { acquireFaceMeshInstance } = await import("./faceMesh");
    await expect(acquireFaceMeshInstance()).rejects.toThrow("initialization failed");
    expect(await acquireFaceMeshInstance()).toBe(instance);
    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it("recovery closes the previous instance and a stale failure cannot evict its replacement", async () => {
    const previous = tracker();
    const replacement = tracker();
    const afterFailure = tracker();
    createWorker.mockResolvedValueOnce(previous).mockResolvedValueOnce(replacement).mockResolvedValueOnce(afterFailure);
    const { acquireFaceMeshInstance, recreateFaceMeshInstance, forgetFailedFaceMeshInstance } = await import("./faceMesh");
    await acquireFaceMeshInstance();
    expect(await recreateFaceMeshInstance()).toBe(replacement);
    expect(previous.close).toHaveBeenCalledTimes(1);
    forgetFailedFaceMeshInstance(previous);
    expect(await acquireFaceMeshInstance()).toBe(replacement);
    expect(createWorker).toHaveBeenCalledTimes(2);
    forgetFailedFaceMeshInstance(replacement);
    expect(await acquireFaceMeshInstance()).toBe(afterFailure);
    expect(replacement.close).not.toHaveBeenCalled();
  });
});
