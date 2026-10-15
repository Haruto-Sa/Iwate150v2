import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createCameraStream } from "./cameraStream";

const getUserMedia = vi.fn();
const trackStop = vi.fn();
const media = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
let video: HTMLVideoElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  getUserMedia.mockReset().mockResolvedValue(media);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  video = document.createElement("video");
  video.play = vi.fn().mockResolvedValue(undefined);
  video.pause = vi.fn();
  Object.defineProperty(video, "readyState", { value: HTMLMediaElement.HAVE_CURRENT_DATA });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("owns one video stream and releases it on stop", async () => {
  const camera = createCameraStream(video, { facingMode: "environment", onFrame: async () => {}, onError: vi.fn() });
  await camera.start();
  expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: { facingMode: "environment", width: 1280, height: 720 } });
  expect(video.srcObject).toBe(media);
  camera.stop();
  expect(trackStop).toHaveBeenCalledTimes(1);
  expect(video.srcObject).toBeNull();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
});

it("propagates device errors without displaying a blocking alert", async () => {
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
  getUserMedia.mockRejectedValue(new DOMException("missing", "NotFoundError"));
  const camera = createCameraStream(video, { facingMode: "user", onFrame: async () => {}, onError: vi.fn() });
  await expect(camera.start()).rejects.toMatchObject({ name: "NotFoundError" });
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

it("releases a stream whose permission is granted after navigation away", async () => {
  let grant!: (stream: MediaStream) => void;
  getUserMedia.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
  const camera = createCameraStream(video, { facingMode: "user", onFrame: async () => {}, onError: vi.fn() });
  const starting = camera.start();
  const rejected = expect(starting).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  camera.stop();
  await rejected;
  grant(media);
  await vi.advanceTimersByTimeAsync(0);
  expect(trackStop).toHaveBeenCalledTimes(1);
  expect(video.play).not.toHaveBeenCalled();
});

it("times out and releases a late camera stream", async () => {
  let grant!: (stream: MediaStream) => void;
  getUserMedia.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
  const camera = createCameraStream(video, { facingMode: "user", onFrame: async () => {}, onError: vi.fn() });
  const rejected = expect(camera.start()).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(15_000);
  await rejected;
  grant(media);
  await vi.advanceTimersByTimeAsync(0);
  expect(trackStop).toHaveBeenCalledTimes(1);
});

it("releases the stream when video playback fails", async () => {
  video.play = vi.fn().mockRejectedValue(new Error("play failed"));
  const camera = createCameraStream(video, { facingMode: "user", onFrame: async () => {}, onError: vi.fn() });
  await expect(camera.start()).rejects.toThrow("play failed");
  expect(trackStop).toHaveBeenCalledTimes(1);
  expect(video.srcObject).toBeNull();
});

it("waits for a frame to finish and does not reschedule after stop", async () => {
  let complete!: () => void;
  const onFrame = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
  const camera = createCameraStream(video, { facingMode: "user", onFrame, onError: vi.fn() });
  await camera.start();
  const tick = vi.mocked(requestAnimationFrame).mock.calls[0][0];
  const pending = tick(0);
  expect(onFrame).toHaveBeenCalledTimes(1);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  camera.stop();
  complete();
  await pending;
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
});

it("stops and reports a failed frame", async () => {
  const onError = vi.fn();
  const error = new Error("frame failed");
  const camera = createCameraStream(video, { facingMode: "user", onFrame: async () => { throw error; }, onError });
  await camera.start();
  await vi.mocked(requestAnimationFrame).mock.calls[0][0](0);
  expect(onError).toHaveBeenCalledWith(error);
  expect(trackStop).toHaveBeenCalledTimes(1);
});
