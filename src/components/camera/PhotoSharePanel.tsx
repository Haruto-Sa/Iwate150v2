"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePreparedPhoto } from "@/hooks/usePreparedPhoto";

const caption = "岩手旅の思い出。 #岩手旅 #VOJAIWATE";

/**
 * 実際に送る写真ファイルを共有できるか確認する。
 * @param file - 編集済みのPNG
 * @returns 写真共有対応時はtrue。権限などの例外時もfalse
 * @example supportsPhotoShare(file);
 */
function supportsPhotoShare(file: File): boolean {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function"
      && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * 撮影した最新の写真をSNSへ渡す。写真なしの共有には切り替えない。
 * @param props.build - 最新の編集結果をPNGにする関数（useCallbackで保持）
 * @param props.hasPhoto - 撮影画像の有無
 * @returns 共有、ダウンロード、本文コピーと手動添付の案内
 * @example <PhotoSharePanel build={generateImage} hasPhoto={Boolean(photo)} />
 */
export function PhotoSharePanel({ build, hasPhoto }: { build: () => Promise<Blob | null>; hasPhoto: boolean }) {
  const { file, error, preparing, retry } = usePreparedPhoto(build, hasPhoto);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDownloadUrl({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canShare = file ? supportsPhotoShare(file) : false;
  const href = downloadUrl?.file === file ? downloadUrl?.url : undefined;

  /**
   * ユーザーのタップと同じ実行内で共有を開始する（iOSの操作権限を保持）。
   * @returns 共有処理の終了
   * @example onClick={sharePhoto}
   */
  async function sharePhoto() {
    if (!file || busyRef.current || !canShare) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      // 本文を併せて渡すと写真を受け取れないSNSがあるため、画像のみを送る。
      await navigator.share({ files: [file] });
      setMessage("写真を共有先に渡しました。送信・投稿は選んだアプリで確認してください。");
    } catch (cause) {
      if (typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError") {
        setMessage("共有をキャンセルしました。写真はこの画面に残っています。");
      } else {
        setMessage("共有を開けませんでした。もう一度試すか、写真を保存してSNSで添付してください。");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  /**
   * SNSが本文を受け取らない場合にも使える投稿文コピー。
   * @returns コピー処理の終了
   * @example onClick={copyCaption}
   */
  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setMessage("投稿文をコピーしました。SNSの本文欄に貼り付けてください。");
    } catch {
      setMessage("コピーできませんでした。下の投稿文を選択してコピーしてください。");
    }
  }

  return (
    <section aria-labelledby="photo-share-title" className="rounded-2xl border border-[#285449]/20 bg-[#f6f5ee] p-4 sm:p-6">
      <p className="text-[10px] font-semibold tracking-[0.22em] text-[#53665c]">IWATE / TRAVEL MEMORIES</p>
      <h2 id="photo-share-title" className="mt-2 text-xl font-semibold text-[#173f35]">旅の一枚を、届けよう。</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#53665c]">Instagram・X・LINE・Facebook など、写真を受け取れるアプリへ。</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={sharePhoto} disabled={!canShare || busy || preparing} className="min-h-12 gap-2 !bg-[#173f35] !text-white">
          <Share2 aria-hidden="true" className="h-4 w-4" />
          {preparing ? "写真を準備中…" : busy ? "共有メニューを開いています…" : "写真を添付して共有"}
        </Button>
        {href && !busy && (
          <a href={href} download="iwate-memory.png" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#285449]/30 bg-white px-4 text-sm font-medium text-[#173f35]">
            <Download aria-hidden="true" className="h-4 w-4" />写真を保存
          </a>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#53665c]">
        {canShare
          ? "共有メニューで投稿先を選ぶと、写真が渡されます。表示されるアプリや投稿先は端末・SNSによって異なります。"
          : file ? "このブラウザでは写真付きの共有メニューを使えません。写真を保存し、SNSの投稿画面で添付してください。"
          : "編集を終えると、共有する写真を準備します。"}
      </p>
      {error && <div role="alert" className="mt-3 text-sm text-red-800">{error} <button type="button" onClick={retry} className="min-h-11 underline underline-offset-4">もう一度準備する</button></div>}
      <p role="status" aria-live="polite" className="mt-2 text-sm text-[#173f35]">{message}</p>

      <div className="mt-4 border-t border-[#285449]/15 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="photo-caption" className="text-xs font-semibold text-[#53665c]">一緒に添える投稿文</label>
          <button type="button" onClick={copyCaption} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#173f35]"><Copy aria-hidden="true" className="h-3.5 w-3.5" />投稿文をコピー</button>
        </div>
        <textarea id="photo-caption" readOnly value={caption} rows={2} className="w-full resize-none rounded-lg border border-[#285449]/20 bg-white p-3 text-sm text-[#173f35]" />
      </div>
      <details className="mt-3 text-xs leading-relaxed text-[#53665c]">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">投稿先が見つからないとき</summary>
        <p>「写真を保存」でダウンロードし、各アプリで写真を選んでください。保存先は端末によって「ファイル」や「ダウンロード」になります。</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Instagram・X・Facebook：投稿の作成から、保存した写真を追加。</li>
          <li>LINE：送りたいトークを開き、写真またはファイルを添付。</li>
        </ul>
      </details>
    </section>
  );
}
