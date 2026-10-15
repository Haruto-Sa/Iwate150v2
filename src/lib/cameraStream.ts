type CameraOptions = {
  facingMode: "user" | "environment";
  onFrame: () => Promise<void>;
  onError: (error: unknown) => void;
};

/**
 * ブラウザのカメラを一つだけ所有し、フレーム処理を直列に実行する。
 * MediaPipe camera_utilsの失敗時alertを使わず、呼び出し元へ例外を返す。
 * @param video - ストリームを表示する要素
 * @param options - カメラの向きとフレーム処理
 * @returns 開始・停止操作。停止後に届いたstreamも直ちに解放する
 * @example const camera = createCameraStream(video, { facingMode: "user", onFrame, onError });
 */
export function createCameraStream(video: HTMLVideoElement, options: CameraOptions) {
  let generation = 0;
  let stream: MediaStream | null = null;
  let frame: number | null = null;
  let cancelStart: (() => void) | null = null;

  /**
   * カメラと予約フレームを解放し、準備中の開始処理も終了する。
   * @returns なし
   * @example camera.stop();
   */
  function stop() {
    generation += 1;
    cancelStart?.();
    cancelStart = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      if (video.srcObject === stream) {
        video.pause();
        video.srcObject = null;
      }
      stream = null;
    }
  }

  /**
   * カメラを取得・再生し、処理の完了後に次のフレームを予約する。
   * @returns カメラ再生開始。権限拒否・不在・15秒超過は例外
   * @example await camera.start();
   */
  async function start() {
    stop();
    const token = generation;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      cancelStart = () => reject(new DOMException("Camera stopped", "AbortError"));
      deadline = setTimeout(() => reject(new DOMException("Camera start timed out", "TimeoutError")), 15_000);
    });
    try {
      const acquired = Promise.resolve().then(() => navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: options.facingMode, width: 1280, height: 720 },
      })).then((media) => {
        if (generation !== token) {
          media.getTracks().forEach((track) => track.stop());
          throw new DOMException("Camera stopped", "AbortError");
        }
        return media;
      });
      stream = await Promise.race([acquired, cancelled]);
      video.srcObject = stream;
      await Promise.race([video.play(), cancelled]);
      if (generation !== token) return;

      let previousVideoTime = -1;
      /**
       * 同じフレームの重複推論を避けて次の処理を予約する。
       * @returns フレーム処理の終了
       * @example requestAnimationFrame(tick);
       */
      async function tick() {
        if (generation !== token) return;
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== previousVideoTime) {
            previousVideoTime = video.currentTime;
            await options.onFrame();
          }
        } catch (error) {
          if (generation === token) {
            stop();
            options.onError(error);
          }
          return;
        }
        if (generation === token) frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    } catch (error) {
      if (generation === token) stop();
      throw error;
    } finally {
      clearTimeout(deadline);
      if (generation === token) cancelStart = null;
    }
  }

  return { start, stop };
}
