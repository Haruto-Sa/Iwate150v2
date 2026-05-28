"use client";

import { useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * PWA インストール促進シート。
 *
 * @returns PwaInstallPrompt
 * @example
 * <PwaInstallPrompt />
 */
export function PwaInstallPrompt() {
  const pathname = usePathname();
  const { dismissForDays, isIosSafari, promptInstall, shouldShow, visitCount } = useInstallPrompt();
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const hiddenRoute = useMemo(
    () => pathname.startsWith("/studio") || pathname.startsWith("/admin"),
    [pathname]
  );

  if (!shouldShow || !isOpen || hiddenRoute) {
    return null;
  }

  return (
    <BottomSheet open={isOpen} title="ホーム画面に追加" onClose={() => setIsOpen(false)}>
      <div className="space-y-5">
        <div className="rounded-[1.5rem] border border-emerald-900/10 bg-white/80 p-4">
          <p className="text-sm leading-7 text-emerald-900/80">
            VOJA IWATE をホーム画面に追加すると、すぐにアクセスできます。
          </p>
          <p className="mt-2 text-xs text-emerald-900/55">訪問回数: {visitCount} 回目</p>
        </div>

        {isIosSafari ? (
          <div className="rounded-[1.5rem] border border-emerald-900/10 bg-emerald-50/80 p-4 text-sm text-emerald-900/80">
            <p className="font-semibold text-[#0f1c1a]">iPhone / iPad では手動追加です</p>
            <p className="mt-2 inline-flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Safari の共有メニューから「ホーム画面に追加」を選んでください。
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              className="flex-1 justify-center gap-2"
              onClick={async () => {
                const outcome = await promptInstall();
                if (outcome === "accepted") {
                  setMessage("ホーム画面への追加が完了しました。");
                  setIsOpen(false);
                  return;
                }
                if (outcome === "dismissed") {
                  setMessage("今は追加を見送りました。あとで再表示できます。");
                  dismissForDays(7);
                  return;
                }
                setMessage("このブラウザではインストール UI を開けませんでした。");
              }}
            >
              <Download className="h-4 w-4" />
              追加する
            </Button>
            <Button
              variant="outline"
              className="flex-1 justify-center"
              onClick={() => {
                dismissForDays(7);
                setMessage("7 日間は再表示しません。");
                setIsOpen(false);
              }}
            >
              あとで
            </Button>
          </div>
        )}

        {message && <p className="text-xs text-emerald-900/70">{message}</p>}
      </div>
    </BottomSheet>
  );
}
