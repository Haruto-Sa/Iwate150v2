import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMERA_VIDEO_MAX_BYTES, CAMERA_VIDEO_MAX_MS, getCameraRecordingMime, startCameraRecording } from "./cameraRecording";

let recorder: {
  state: string;
  mimeType: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  ondataavailable: null | ((event: { data: Blob }) => void);
  onstop: null | (() => void);
  onerror: null | (() => void);
};
let track: { stop: ReturnType<typeof vi.fn>; onended: null | (() => void) };
let canvas: HTMLCanvasElement;

beforeEach(() => {
  vi.useFakeTimers();
  track = { stop: vi.fn(), onended: null };
  recorder = {
    state: "inactive", mimeType: "video/webm", ondataavailable: null, onstop: null, onerror: null,
    start: vi.fn(() => { recorder.state = "recording"; }),
    stop: vi.fn(() => { recorder.state = "inactive"; }),
  };
  const constructor = Object.assign(vi.fn(function () { return recorder; }), { isTypeSupported: vi.fn((mime: string) => mime === "video/webm") });
  vi.stubGlobal("MediaRecorder", constructor);
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", { configurable: true, value: vi.fn(() => ({ getTracks: () => [track] })) });
  canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 480;
});
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, "captureStream");
});

describe("bounded camera recording", () => {
  it("preserves the requested cadence across animation-frame rounding", async () => {
    const draw = vi.fn();
    const recording = startCameraRecording(canvas, draw, vi.fn());
    const cancelled = expect(recording.result).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1000);
    const count = draw.mock.calls.length;
    recording.cancel();
    await cancelled;
    expect(count).toBe(15);
  });

  it("skips missed frames after a stall instead of drawing a burst", async () => {
    let nextFrame!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }));
    const draw = vi.fn();
    const now = performance.now();
    const recording = startCameraRecording(canvas, draw, vi.fn());
    const cancelled = expect(recording.result).rejects.toMatchObject({ name: "AbortError" });
    nextFrame(now + 5000);
    expect(draw).toHaveBeenCalledTimes(2);
    nextFrame(now + 5016);
    expect(draw).toHaveBeenCalledTimes(2);
    recording.cancel();
    await cancelled;
  });

  it("selects a supported format and returns the final chunk with earlier chunks", async () => {
    expect(getCameraRecordingMime()).toBe("video/webm");
    const recording = startCameraRecording(canvas, vi.fn(), vi.fn());
    recorder.ondataavailable!({ data: new Blob(["first"]) });
    recording.stop(); recording.stop();
    expect(recorder.stop).toHaveBeenCalledOnce();
    recorder.ondataavailable!({ data: new Blob(["last"]) });
    recorder.onstop!();
    const result = await recording.result;
    expect(result.size).toBe(9);
    expect(result.type).toBe("video/webm");
    expect(track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops automatically and bounds a missing stop event", async () => {
    const recording = startCameraRecording(canvas, vi.fn(), vi.fn());
    const assertion = expect(recording.result).rejects.toThrow("stop timed out");
    await vi.advanceTimersByTimeAsync(CAMERA_VIDEO_MAX_MS);
    expect(recorder.stop).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an oversized final chunk instead of returning a partial video", async () => {
    const recording = startCameraRecording(canvas, vi.fn(), vi.fn());
    const assertion = expect(recording.result).rejects.toThrow("size limit");
    recording.stop();
    recorder.ondataavailable!({ data: new Blob([new Uint8Array(CAMERA_VIDEO_MAX_BYTES + 1)]) });
    await assertion;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(recorder.onstop).toBeNull();
  });

  it("cancels and ignores late encoder events", async () => {
    const recording = startCameraRecording(canvas, vi.fn(), vi.fn());
    const lateStop = recorder.onstop!;
    const assertion = expect(recording.result).rejects.toMatchObject({ name: "AbortError" });
    recording.cancel(); recording.cancel(); lateStop();
    await assertion;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the stream when starting the encoder fails", async () => {
    recorder.start.mockImplementation(() => { throw new Error("encoder unavailable"); });
    const recording = startCameraRecording(canvas, vi.fn(), vi.fn());
    await expect(recording.result).rejects.toThrow("encoder unavailable");
    expect(track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the stream when constructing the encoder fails", () => {
    vi.mocked(MediaRecorder).mockImplementationOnce(function () { throw new Error("constructor failed"); });
    expect(() => startCameraRecording(canvas, vi.fn(), vi.fn())).toThrow("constructor failed");
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("discards the recording when the stream ends or drawing fails", async () => {
    const recording = startCameraRecording(canvas, vi.fn(), vi.fn());
    const assertion = expect(recording.result).rejects.toThrow("stream ended");
    track.onended!();
    await assertion;
    const draw = vi.fn().mockImplementationOnce(() => undefined).mockImplementation(() => { throw new Error("draw failed"); });
    const next = startCameraRecording(canvas, draw, vi.fn());
    const nextAssertion = expect(next.result).rejects.toThrow("draw failed");
    await vi.advanceTimersByTimeAsync(100);
    await nextAssertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects empty output and unsupported APIs without allocating a stream", async () => {
    const recording = startCameraRecording(canvas, vi.fn(), vi.fn());
    const assertion = expect(recording.result).rejects.toThrow("empty");
    recorder.state = "inactive"; recorder.onstop!();
    await assertion;
    vi.stubGlobal("MediaRecorder", undefined);
    expect(getCameraRecordingMime()).toBeNull();
    expect(() => startCameraRecording(canvas, vi.fn(), vi.fn())).toThrow("unavailable");
  });

  it("refuses oversized output before creating the encoder", () => {
    canvas.width = 721;
    expect(() => startCameraRecording(canvas, vi.fn(), vi.fn())).toThrow("size limit");
    expect(MediaRecorder).not.toHaveBeenCalled();
  });
});
