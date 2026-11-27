import { Suspense } from "react";
import { LoginPageClient } from "@/components/auth/LoginPageClient";

/**
 * ログインページの server wrapper。
 *
 * @returns LoginPage
 * @example
 * <LoginPage />
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-[28px] border border-app-line/10 bg-app-surface p-6 text-sm text-app-ink-muted shadow-sm">
          ログイン画面を準備しています...
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
