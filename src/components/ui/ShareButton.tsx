"use client";

import { useState } from "react";
import { Share2, Twitter, Link2, Check } from "lucide-react";
import { ToastContainer } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

type Props = {
  /** シェア時のタイトル */
  title: string;
  /** シェア時のテキスト（OGP description に相当） */
  text: string;
  /** シェアする URL */
  url: string;
};

/**
 * SNS シェアボタンコンポーネント。
 *
 * Web Share API 対応ブラウザではネイティブシェートシートを表示し、
 * 非対応の場合は X(Twitter)・LINE・URLコピー の個別ボタンを表示する。
 *
 * @param props.title - シェアタイトル
 * @param props.text - シェアテキスト
 * @param props.url - シェアURL（絶対URL）
 * @returns ShareButton コンポーネント
 * @example
 * <ShareButton
 *   title="中尊寺金色堂"
 *   text="中尊寺金色堂を発見！ #VOJAIWATE #岩手旅"
 *   url="https://iwate150.vercel.app/spots/1-chusonji"
 * />
 */
export function ShareButton({ title, text, url }: Props) {
  const { toasts, show, dismiss } = useToast();
  const [copied, setCopied] = useState(false);

  const shareText = `${text} #VOJAIWATE #岩手旅 ${url}`;

  /** Web Share API でネイティブシェートを開く */
  async function handleNativeShare() {
    try {
      await navigator.share({ title, text: shareText, url });
    } catch {
      // ユーザーがキャンセルした場合などは無視
    }
  }

  /** クリップボードに URL をコピーする */
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      show("URLをコピーしました", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show("コピーできませんでした", "error");
    }
  }

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  /** Web Share API 対応チェック（SSR 対応のため typeof チェック） */
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-900/60">
        この場所をシェア
      </p>

      {canNativeShare ? (
        /* Web Share API 対応環境 */
        <button
          onClick={handleNativeShare}
          className="interactive-lift inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-md transition duration-200 hover:bg-emerald-800"
        >
          <Share2 className="h-4 w-4" />
          シェアする
        </button>
      ) : (
        /* フォールバック: 個別シェアボタン */
        <div className="flex flex-wrap gap-2">
          {/* X (Twitter) */}
          <a
            href={twitterHref}
            target="_blank"
            rel="noopener noreferrer"
            className="interactive-lift inline-flex items-center gap-2 rounded-2xl border border-[#1d9bf0]/30 bg-[#1d9bf0]/10 px-4 py-2 text-sm font-medium text-[#1d9bf0] transition duration-200 hover:bg-[#1d9bf0]/20"
            aria-label="X(Twitter) でシェア"
          >
            <Twitter className="h-4 w-4" />
            X でシェア
          </a>

          {/* LINE */}
          <a
            href={lineHref}
            target="_blank"
            rel="noopener noreferrer"
            className="interactive-lift inline-flex items-center gap-2 rounded-2xl border border-[#06C755]/30 bg-[#06C755]/10 px-4 py-2 text-sm font-medium text-[#06C755] transition duration-200 hover:bg-[#06C755]/20"
            aria-label="LINE でシェア"
          >
            <span className="font-bold text-xs leading-none">LINE</span>
            LINE でシェア
          </a>

          {/* URLコピー */}
          <button
            onClick={handleCopy}
            className="interactive-lift inline-flex items-center gap-2 rounded-2xl border border-emerald-900/20 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 transition duration-200 hover:bg-white"
            aria-label="URLをコピー"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {copied ? "コピー済み" : "URLをコピー"}
          </button>
        </div>
      )}

      {/* トースト通知 */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
