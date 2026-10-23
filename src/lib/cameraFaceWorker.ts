import type { NormalizedLandmarkListList } from "@mediapipe/face_mesh";
import { markCameraTiming } from "./cameraTimings";

export type CameraFaceResults = { multiFaceLandmarks: NormalizedLandmarkListList };
export type CameraFaceTracker = {
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  onResults: (listener: (results: CameraFaceResults) => void) => void;
  close: () => Promise<void>;
};
export const CAMERA_FACE_TIMEOUT_MS = 20_000;

/**
 * 画面を止めずに顔検出するWorkerを初期化する。初期化と各フレームの待機を制限する。
 * @param assetBase - MediaPipeの既存アセット配信先
 * @returns 同時に1フレームだけ処理する顔検出器
 * @example const tracker = await createCameraFaceWorker('/mediapipe/face_mesh');
 */
export async function createCameraFaceWorker(assetBase: string): Promise<CameraFaceTracker> {
  const worker = new Worker("/mediapipe/face_mesh/worker.js");
  let listener: (results: CameraFaceResults) => void = () => undefined;
  let closed = false;
  let frameResponse: Promise<void> | null = null;
  let frameListener = listener;
  let pending: { resolve: () => void; reject: (error: Error) => void } | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;

  /**
   * 失敗または離脱でWorkerと待機処理を終了する。
   * @param error - 待機中の呼び出しへ返す理由
   * @returns なし
   * @example fail(new Error('Worker unavailable'));
   */
  function fail(error: Error): void {
    closed = true;
    clearTimeout(deadline);
    worker.terminate();
    const current = pending;
    pending = null;
    current?.reject(error);
  }

  /**
   * 1件だけ期限付きで待つ。入力画像の作成時間も期限に含める。
   * @returns Workerの応答待ち
   * @example const response = waitForResponse();
   */
  function waitForResponse(): Promise<void> {
    if (closed) return Promise.reject(new Error("Face worker is closed"));
    if (pending) return Promise.reject(new Error("Face worker already has a pending frame"));
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      deadline = setTimeout(() => fail(new Error("Face worker timed out")), CAMERA_FACE_TIMEOUT_MS);
    });
  }

  worker.onerror = (event) => fail(new Error(`Face worker failed: ${event?.message?.slice(0, 512) ?? "unknown error"}`));
  worker.onmessageerror = () => fail(new Error("Face worker response could not be read"));
  worker.onmessage = ({ data }: MessageEvent<{ type: string; message?: string; stage?: string; multiFaceLandmarks: NormalizedLandmarkListList }>) => {
    if (closed || !pending) return;
    if (data.type === "error") {
      fail(new Error(`Face inference failed (${data.stage ?? "unknown"}): ${data.message?.slice(0, 512) ?? "unknown error"}`));
      return;
    }
    if (data.type !== "ready" && data.type !== "result") return;
    clearTimeout(deadline);
    const current = pending;
    pending = null;
    if (data.type === "result" && frameListener === listener) listener({ multiFaceLandmarks: data.multiFaceLandmarks });
    current.resolve();
  };

  markCameraTiming("face:initialize:start");
  const ready = waitForResponse();
  // Preserve the package's existing iOS CPU preference in the document-free Worker.
  const useCpuInference = ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(navigator.platform)
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  try {
    worker.postMessage({ type: "init", assetBase: new URL(assetBase, location.href).href.replace(/\/$/, ""), useCpuInference });
  } catch (error) {
    fail(error instanceof Error ? error : new Error(String(error)));
  }
  await ready;
  markCameraTiming("face:initialize:end");

  return {
    /**
     * 動画1フレームをWorkerへ渡し、結果まで待つ。
     * @param input - カメラ映像
     * @returns 顔検出の完了
     * @example await tracker.send({ image: video });
     */
    send({ image }): Promise<void> {
      if (closed) return Promise.reject(new Error("Face worker unavailable"));
      if (frameResponse) return frameResponse;
      frameListener = listener;
      const response = waitForResponse().finally(() => { frameResponse = null; });
      frameResponse = response;
      // Do not await bitmap creation here: the caller must observe the same deadline.
      void Promise.resolve().then(() => createImageBitmap(image)).then((bitmap) => {
        if (closed) { bitmap.close(); return; }
        try {
          worker.postMessage({ type: "frame", image: bitmap }, [bitmap]);
        } catch (error) {
          bitmap.close();
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      }, (error) => fail(error instanceof Error ? error : new Error(String(error))));
      return response;
    },
    /**
     * 結果の購読先を置き換える。
     * @param next - 結果ハンドラ（離脱時は空ハンドラ）
     * @returns なし
     * @example tracker.onResults(handleFaces);
     */
    onResults(next): void { listener = next; },
    /**
     * WorkerとGPU資源を解放し、処理中の待機も終了する。
     * @returns 終了完了
     * @example await tracker.close();
     */
    async close(): Promise<void> { fail(new Error("Face worker closed")); },
  };
}
