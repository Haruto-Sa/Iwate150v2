"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { CAMERA_VIDEO_MAX_EDGE, getCameraRecordingMime, startCameraRecording, type CameraRecording } from "@/lib/cameraRecording";

/**
 * 録画データ、生成URL、共有操作と中断時の解放を管理する。
 * @param unmountedRef - 親のマウント状態。既存のeffect順序で更新する
 * @param onError - 親のエラー表示を更新する安定した関数
 * @returns 録画状態と開始・停止・中断・共有・破棄操作
 * @example const video = useCameraVideo(unmountedRef, setErrorMessage);
 */
export function useCameraVideo(unmountedRef: RefObject<boolean>, onError: (message: string | null) => void) {
  const [videoSupported, setVideoSupported] = useState(false);
  const [recordingPhase, setRecordingPhase] = useState<"idle" | "recording" | "stopping">("idle");
  const [recordedMilliseconds, setRecordedMilliseconds] = useState(0);
  const [recordedClip, setRecordedClip] = useState<{ file: File; url: string } | null>(null);
  const [sharingVideo, setSharingVideo] = useState(false);
  const recordingRef = useRef<CameraRecording | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const sharingVideoRef = useRef(false);
  const videoBusy = recordingPhase !== "idle";

  /**
   * 録画中の未完成データを破棄する。
   * @returns なし
   * @example cancelRecording();
   */
  const cancelRecording = useCallback(() => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    recording?.cancel();
    if (recording && !unmountedRef.current) {
      setRecordingPhase("idle");
      onError("録画を中断しました。もう一度録画してください。");
    }
  }, [unmountedRef, onError]);

  useEffect(() => {
    // SSRでは存在しないMediaRecorderの対応状況をマウント後に確認する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoSupported(getCameraRecordingMime() !== null);
    /** バックグラウンドの未完成動画を破棄する。@returns なし @example onHidden(); */
    function onHidden() { if (document.hidden) cancelRecording(); }
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("orientationchange", cancelRecording);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("orientationchange", cancelRecording);
      cancelRecording();
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, [cancelRecording]);


  /**
   * 現在の録画を停止し、最後のデータを待つ。
   * @returns 停止対象の録画があればtrue
   * @example if (stopRecording()) return;
   */
  function stopRecording(): boolean {
    if (!recordingRef.current) return false;
    setRecordingPhase("stopping");
    recordingRef.current.stop();
    return true;
  }

  /**
   * 親の描画関数で合成した映像の録画を開始する。
   * @param drawFrame - 写真と共通の切り抜き・合成処理
   * @param onRecorded - 動画を確定した後のカメラ停止・画面更新
   * @returns なし
   * @example beginRecording(drawCaptureFrame, onRecorded);
   */
  function beginRecording(drawFrame: (canvas: HTMLCanvasElement, resize: boolean, maxEdge?: number) => void, onRecorded: () => void): void {
    onError(null);
    setRecordedMilliseconds(0);
    try {
      const output = document.createElement("canvas");
      drawFrame(output, true, CAMERA_VIDEO_MAX_EDGE);
      const recording = startCameraRecording(output, () => drawFrame(output, false), (ms) => setRecordedMilliseconds(Math.floor(ms / 1000) * 1000));
      recordingRef.current = recording;
      setRecordingPhase("recording");
      void recording.result.then((blob) => {
        if (unmountedRef.current || recordingRef.current !== recording) return;
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `iwate-trip.${extension}`, { type: blob.type });
        const url = URL.createObjectURL(file);
        recordingRef.current = null;
        recordedUrlRef.current = url;
        setRecordedClip({ file, url });
        setRecordingPhase("idle");
        onRecorded();
      }).catch(() => {
        if (unmountedRef.current || recordingRef.current !== recording) return;
        recordingRef.current = null;
        setRecordingPhase("idle");
        onError("動画を保存できませんでした。もう一度録画するか、写真を撮ってください。");
      });
    } catch {
      setRecordingPhase("idle");
      onError("録画を開始できませんでした。もう一度試すか、写真を撮ってください。");
    }
  }

  /**
   * 準備済み動画ファイルをユーザー操作と同じ実行内で共有する。
   * @returns 共有操作の完了
   * @example void shareRecordedVideo();
   */
  async function shareRecordedVideo(): Promise<void> {
    if (!recordedClip || sharingVideoRef.current) return;
    sharingVideoRef.current = true;
    setSharingVideo(true);
    onError(null);
    try { await navigator.share({ files: [recordedClip.file] }); } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) onError("共有できませんでした。動画を保存して添付してください。");
    } finally { sharingVideoRef.current = false; setSharingVideo(false); }
  }

  let canShareVideo = false;
  try { canShareVideo = !!recordedClip && typeof navigator.share === "function" && navigator.canShare?.({ files: [recordedClip.file] }) === true; } catch { /* 保存操作は常に残す。 */ }

  /**
   * 撮影へ戻る前に確定動画のURLを解放する。
   * @returns なし
   * @example clearRecordedClip();
   */
  function clearRecordedClip(): void {
    if (!recordedClip) return;
    URL.revokeObjectURL(recordedClip.url);
    recordedUrlRef.current = null;
    setRecordedClip(null);
  }

  return { videoSupported, recordingPhase, recordedMilliseconds, recordedClip, sharingVideo,
    videoBusy, cancelRecording, stopRecording, beginRecording, shareRecordedVideo, canShareVideo, clearRecordedClip };
}
