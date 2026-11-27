import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startCameraRecording, type CameraRecording } from "@/lib/cameraRecording";
import { useCameraVideo } from "./useCameraVideo";

vi.mock("@/lib/cameraRecording", () => ({
  CAMERA_VIDEO_MAX_EDGE: 720,
  getCameraRecordingMime: () => "video/webm",
  startCameraRecording: vi.fn(),
}));

/**
 * 後から確定できる録画を用意する。
 * @returns 録画の操作と完了通知
 * @example const pending = deferredRecording();
 */
function deferredRecording() {
  let resolve!: (blob: Blob) => void;
  const recording: CameraRecording = {
    result: new Promise<Blob>(done => { resolve = done; }),
    stop: vi.fn(), cancel: vi.fn(),
  };
  return { recording, resolve };
}

beforeEach(() => {
  vi.mocked(startCameraRecording).mockReset();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recording");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("停止後の動画を確定し、撮影へ戻るとURLを一度だけ解放する", async () => {
  const pending = deferredRecording();
  vi.mocked(startCameraRecording).mockReturnValue(pending.recording);
  const complete = vi.fn();
  const draw = vi.fn();
  const mounted = { current: false };
  const onError = vi.fn();
  const { result, unmount } = renderHook(() => useCameraVideo(mounted, onError));
  act(() => result.current.beginRecording(draw, complete));
  expect(result.current.recordingPhase).toBe("recording");
  expect(draw).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), true, 720);
  act(() => { expect(result.current.stopRecording()).toBe(true); });
  expect(result.current.recordingPhase).toBe("stopping");
  expect(pending.recording.stop).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(new Blob(["video"], { type: "video/mp4" })));
  expect(result.current.recordedClip?.file.name).toBe("iwate-trip.mp4");
  expect(complete).toHaveBeenCalledTimes(1);
  act(() => result.current.clearRecordedClip());
  expect(result.current.recordedClip).toBeNull();
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:recording");
});

it("向き変更で取り消した録画の遅延結果を、新しい録画へ持ち越さない", async () => {
  const old = deferredRecording();
  const next = deferredRecording();
  vi.mocked(startCameraRecording).mockReturnValueOnce(old.recording).mockReturnValueOnce(next.recording);
  const oldComplete = vi.fn();
  const nextComplete = vi.fn();
  const mounted = { current: false };
  const onError = vi.fn();
  const { result, rerender } = renderHook(() => useCameraVideo(mounted, onError));
  act(() => result.current.beginRecording(vi.fn(), oldComplete));
  rerender();
  expect(old.recording.cancel).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("orientationchange")));
  expect(old.recording.cancel).toHaveBeenCalledTimes(1);
  expect(result.current.recordingPhase).toBe("idle");
  act(() => result.current.beginRecording(vi.fn(), nextComplete));
  await act(async () => old.resolve(new Blob(["old"], { type: "video/webm" })));
  expect(result.current.recordedClip).toBeNull();
  expect(result.current.recordingPhase).toBe("recording");
  expect(oldComplete).not.toHaveBeenCalled();
  await act(async () => next.resolve(new Blob(["next"], { type: "video/webm" })));
  expect(result.current.recordedClip?.file.name).toBe("iwate-trip.webm");
  expect(nextComplete).toHaveBeenCalledTimes(1);
});

it("離脱で未完成の録画を破棄し、後から完了してもURLを生成しない", async () => {
  const pending = deferredRecording();
  vi.mocked(startCameraRecording).mockReturnValue(pending.recording);
  const mounted = { current: false };
  const onError = vi.fn();
  const complete = vi.fn();
  const { result, unmount } = renderHook(() => useCameraVideo(mounted, onError));
  act(() => result.current.beginRecording(vi.fn(), complete));
  mounted.current = true;
  unmount();
  await act(async () => pending.resolve(new Blob(["late"], { type: "video/webm" })));
  expect(pending.recording.cancel).toHaveBeenCalledTimes(1);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
});

it("合成の開始失敗を表示し、録画状態に進まない", () => {
  const mounted = { current: false };
  const onError = vi.fn();
  const { result } = renderHook(() => useCameraVideo(mounted, onError));
  act(() => result.current.beginRecording(() => { throw new Error("draw failed"); }, vi.fn()));
  expect(result.current.videoBusy).toBe(false);
  expect(onError).toHaveBeenLastCalledWith("録画を開始できませんでした。もう一度試すか、写真を撮ってください。");
  expect(startCameraRecording).not.toHaveBeenCalled();
});
