import type { RefObject } from "react";
import { Sparkles, Camera as CameraIcon, RefreshCw, SwitchCamera, X, Video, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CameraFacingMode } from "@/lib/cameraStream";
import type { CaptureDelay } from "@/hooks/useCaptureTimer";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  activeFacingMode: CameraFacingMode;
  status: "idle" | "starting" | "ready" | "denied" | "captured";
  detection: { x: number; y: number; width: number; height: number } | null;
  remaining: number | null;
  captureMode: "photo" | "video";
  videoBusy: boolean;
  recordingPhase: "idle" | "recording" | "stopping";
  canCapture: boolean;
  busy: boolean;
  captureDelay: CaptureDelay;
  startCamera: () => Promise<void>;
  handleVideoShutter: () => void;
  cancelCapture: () => void;
  startCapture: (delay: CaptureDelay) => void;
  switchCamera: () => void;
};

/**
 * カメラ映像・顔枠・カウントダウンと撮影操作を表示する。
 * @param props - 親が管理する参照、状態と撮影操作
 * @returns 映像表示領域とシャッター
 * @example <CameraPreview {...previewProps} />
 */
export function CameraPreview({ videoRef, overlayCanvasRef, canvasRef, activeFacingMode, status, detection, remaining, captureMode, videoBusy, recordingPhase, canCapture, busy, captureDelay, startCamera, handleVideoShutter, cancelCapture, startCapture, switchCamera }: Props) {
  return (
      <div className="relative aspect-[4/3] w-full max-h-[calc(100dvh-8rem)] overflow-hidden rounded-3xl border border-app-line/10 bg-app-surface sm:aspect-[16/10]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          style={{ transform: activeFacingMode === "user" ? "scaleX(-1)" : "none" }}
        />

        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <canvas ref={canvasRef} className="hidden" />

        {status === "ready" && detection && (
          <div
            className="pointer-events-none absolute rounded-2xl border-2 border-emerald-500/50 shadow-[0_0_40px_rgba(28,157,130,0.25)] transition"
            style={{
              left: `${detection.x * 100}%`,
              top: `${detection.y * 100}%`,
              width: `${detection.width * 100}%`,
              height: `${detection.height * 100}%`,
            }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {status === "starting" && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-app-surface/80 px-4 py-3 text-center shadow-lg">
              <Sparkles className="h-6 w-6 text-app-accent-ink" />
              <p className="text-sm text-app-ink-strong">
                カメラを準備中…
              </p>
            </div>
          )}
        </div>

        {remaining !== null && (
          <div role="status" aria-live="assertive" aria-label={`${remaining}秒後に撮影`} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-2xl bg-black/60 px-6 py-3 text-5xl font-semibold tabular-nums text-white">{remaining}</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="flex items-center gap-3">
            {(status === "idle" || status === "denied") && (
              <Button
                onClick={() => {
                  void startCamera();
                }}
                variant="outline"
                className="pointer-events-auto h-12 px-4 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                もう一度試す
              </Button>
            )}
            <button
              type="button"
              onClick={() => captureMode === "video" ? handleVideoShutter() : remaining !== null ? cancelCapture() : startCapture(captureDelay)}
              aria-label={captureMode === "video" ? (videoBusy ? "録画を停止" : "録画を開始") : remaining !== null ? "タイマーを取り消す" : "写真を撮る"}
              disabled={captureMode === "video" ? recordingPhase === "stopping" || (!videoBusy && !canCapture) : remaining === null && (!canCapture || busy)}
              className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border-4 border-app-line-soft/80 bg-app-surface/90 text-app-ink-strong shadow-xl shadow-emerald-200/50 transition active:scale-95 disabled:opacity-60"
            >
              {captureMode === "video" ? (videoBusy ? <Square className="h-7 w-7 fill-current text-app-danger" aria-hidden="true" /> : <Video className="h-7 w-7" aria-hidden="true" />) : remaining !== null ? <X className="h-7 w-7" aria-hidden="true" /> : <CameraIcon className="h-7 w-7" aria-hidden="true" />}
            </button>
            {/* 内カメ/外カメ切替ボタン（モバイルのみ表示） */}
            {status === "ready" && (
              <button
                onClick={switchCamera}
                disabled={videoBusy}
                className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-app-surface/80 text-app-ink-strong shadow-lg backdrop-blur transition active:scale-95 sm:hidden"
                aria-label="カメラ切替"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
  );
}
