"use client";

import { getGuidePath } from "@/lib/pageGuides";
import { usePageGuideCompleted } from "@/hooks/usePageGuideCompleted";
import { useMenuLanguage } from "@/lib/menuLanguage";

import { useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useOnboardingCompleted } from "@/hooks/useOnboardingCompleted";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * PWA インストール促進シート。
 *
 * @returns PwaInstallPrompt
 * @example
 * <PwaInstallPrompt />
 */
export function PwaInstallPrompt() {
  const { language, messages } = useMenuLanguage();
  const pathname = usePathname();
  const pageGuideCompleted = usePageGuideCompleted(getGuidePath(pathname));
  const isMobileViewport = useIsMobileViewport();
  const onboardingCompleted = useOnboardingCompleted();
  const { dismissForDays, isIosSafari, promptInstall, shouldShow } = useInstallPrompt();
  const [isOpen, setIsOpen] = useState(true);
  const [installFailed, setInstallFailed] = useState(false);

  const hiddenRoute = useMemo(
    () => pathname.startsWith("/studio") || pathname.startsWith("/admin"),
    [pathname]
  );

  if (!pageGuideCompleted || !shouldShow || !isOpen || hiddenRoute || (isMobileViewport && !onboardingCompleted)) {
    return null;
  }

  return (
    <BottomSheet open={isOpen} lang={language} title={messages.install} closeLabel={messages.closeInstall} onClose={() => setIsOpen(false)}>
      <div className="space-y-5">
        {isIosSafari ? (
          <div className="rounded-[1.5rem] border border-app-line/10 bg-app-surface-soft/80 p-4 text-sm text-app-ink/80">
            <p className="mt-2 inline-flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              {messages.safariInstall}
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              className="flex-1 justify-center gap-2"
              onClick={async () => {
                const outcome = await promptInstall();
                if (outcome === "accepted") {
                  setIsOpen(false);
                  return;
                }
                if (outcome === "dismissed") {
                  dismissForDays(7);
                  return;
                }
                setInstallFailed(true);
              }}
            >
              <Download className="h-4 w-4" />
              {messages.add}
            </Button>
            <Button
              variant="outline"
              className="flex-1 justify-center"
              onClick={() => {
                dismissForDays(7);
                setIsOpen(false);
              }}
            >
              {messages.later}
            </Button>
          </div>
        )}

        {installFailed && <p role="alert" className="text-xs text-app-ink-muted">{messages.installFailed}</p>}
      </div>
    </BottomSheet>
  );
}
