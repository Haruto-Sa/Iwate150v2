import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { markCameraTiming, measureCameraWork, resetCameraTimings } from "./cameraTimings";

const mark = vi.fn();
const clearMarks = vi.fn();
beforeEach(() => {
  vi.stubGlobal("performance", { mark, clearMarks });
  resetCameraTimings();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

it("長い描画ループや多数の段階があってもブラウザの記録を64件以内に保つ", () => {
  for (let i = 0; i < 10000; i++) markCameraTiming("frame");
  for (let i = 0; i < 1000; i++) markCameraTiming(`model:${i}`);
  expect(mark).toHaveBeenCalledTimes(64);
  expect(mark.mock.calls.filter(([name]) => name === "iwate-camera:frame")).toHaveLength(1);
});

it("再訪時には自身の記録だけを削除し、新しい計測を開始できる", () => {
  markCameraTiming("camera:start");
  resetCameraTimings();
  expect(clearMarks).toHaveBeenCalledExactlyOnceWith("iwate-camera:camera:start");
  markCameraTiming("camera:start");
  expect(mark).toHaveBeenCalledTimes(2);
});

it("解析失敗を握り潰さず終了時刻を記録する", () => {
  const error = new Error("invalid model");
  expect(() => measureCameraWork("parse", () => { throw error; })).toThrow(error);
  expect(mark.mock.calls).toEqual([["iwate-camera:parse:start"], ["iwate-camera:parse:end"]]);
});
