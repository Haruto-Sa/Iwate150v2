export const CAMERA_VIDEO_MAX_MS = 10_000;
export const CAMERA_VIDEO_MAX_BYTES = 8 * 1024 * 1024;
export const CAMERA_VIDEO_MAX_EDGE = 720;
const FRAME_RATE = 15;
const STOP_TIMEOUT_MS = 3_000;

export type CameraRecording = {
  result: Promise<Blob>;
  stop: () => void;
  cancel: () => void;
};

/**
 * 実行環境が録画できる動画形式を選ぶ。実際の開始失敗は別途扱う。
 * @returns 対応するMIME形式。API/形式が未対応ならnull
 * @example const mime = getCameraRecordingMime();
 */
export function getCameraRecordingMime(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
    .find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null;
}

/**
 * 合成canvasを無音で録画する。カメラ本体のstreamは所有しない。
 * @param canvas - 長辺720px以下の出力専用canvas
 * @param drawFrame - 映像とモデルを同じcanvasへ描く処理
 * @param onElapsed - 録画経過時間の通知（ミリ秒）
 * @returns 停止・破棄操作と、上限内で完了した動画のPromise
 * @example const recording = startCameraRecording(canvas, drawFrame, setElapsed);
 */
export function startCameraRecording(
  canvas: HTMLCanvasElement,
  drawFrame: () => void,
  onElapsed: (milliseconds: number) => void,
): CameraRecording {
  const mimeType = getCameraRecordingMime();
  if (!mimeType) throw new DOMException("Video recording is unavailable", "NotSupportedError");
  if (canvas.width < 1 || canvas.height < 1 || Math.max(canvas.width, canvas.height) > CAMERA_VIDEO_MAX_EDGE) {
    throw new RangeError("Recording canvas exceeds the size limit");
  }
  drawFrame();
  const stream = canvas.captureStream(FRAME_RATE);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  let resolveResult!: (blob: Blob) => void;
  let rejectResult!: (error: Error) => void;
  const result = new Promise<Blob>((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
  let settled = false;
  let stopping = false;
  let bytes = 0;
  const chunks: Blob[] = [];
  let frame = 0;
  let stopTimer: ReturnType<typeof setTimeout>;
  const started = performance.now();
  let lastFrame = started;

  /**
   * 生成streamとイベント・タイマーを解放する。
   * @returns なし
   * @example cleanup();
   */
  function cleanup(): void {
    cancelAnimationFrame(frame);
    clearTimeout(durationTimer);
    clearTimeout(stopTimer);
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    stream.getTracks().forEach((track) => { track.onended = null; });
    try { if (recorder.state !== "inactive") recorder.stop(); } catch {
      // エンコーダの停止失敗でも、元の結果を保ってstreamを解放する。
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      chunks.length = 0;
    }
  }

  /**
   * 不完全な動画を破棄して終了する。
   * @param error - 失敗またはキャンセル理由
   * @returns なし
   * @example fail(new Error("Recording failed"));
   */
  function fail(error: Error): void {
    if (settled) return;
    settled = true;
    try { cleanup(); } finally { rejectResult(error); }
  }

  /**
   * 最終チャンクを待って録画を確定する。停止待ちも期限付き。
   * @returns なし
   * @example recording.stop();
   */
  function stop(): void {
    if (settled || stopping) return;
    stopping = true;
    cancelAnimationFrame(frame);
    clearTimeout(durationTimer);
    stopTimer = setTimeout(() => fail(new Error("Recording stop timed out")), STOP_TIMEOUT_MS);
    try { recorder.stop(); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  }

  /**
   * 上限fpsで合成し、実経過時間によって録画を終了する。
   * @param now - animation frameの時刻
   * @returns なし
   * @example requestAnimationFrame(paint);
   */
  function paint(now: number): void {
    if (settled || stopping) return;
    if (now - started >= CAMERA_VIDEO_MAX_MS) { stop(); return; }
    try {
      if (now - lastFrame >= 1000 / FRAME_RATE) {
        drawFrame();
        onElapsed(now - started);
        // RAF時刻の端数は次回へ持ち越す。遅れたフレームをまとめて描画しない。
        const interval = 1000 / FRAME_RATE;
        lastFrame += Math.floor((now - lastFrame) / interval) * interval;
      }
      frame = requestAnimationFrame(paint);
    } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  }

  recorder.ondataavailable = ({ data }) => {
    if (settled || data.size === 0) return;
    if (bytes + data.size > CAMERA_VIDEO_MAX_BYTES) { fail(new Error("Recording exceeds the size limit")); return; }
    bytes += data.size;
    chunks.push(data);
  };
  recorder.onerror = () => fail(new Error("Recording failed"));
  recorder.onstop = () => {
    if (settled) return;
    if (!bytes) { fail(new Error("Recording is empty")); return; }
    let blob: Blob;
    try { blob = new Blob(chunks, { type: recorder.mimeType || mimeType }); } catch {
      fail(new Error("Recording could not be saved"));
      return;
    }
    settled = true;
    try { cleanup(); } finally { resolveResult(blob); }
  };
  stream.getTracks().forEach((track) => { track.onended = () => fail(new Error("Recording stream ended")); });
  const durationTimer = setTimeout(stop, CAMERA_VIDEO_MAX_MS);
  try {
    recorder.start(250);
    frame = requestAnimationFrame(paint);
  } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  return { result, stop, cancel: () => fail(new DOMException("Recording cancelled", "AbortError")) };
}
