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
        <div className="rounded-[28px] border border-emerald-900/10 bg-white p-6 text-sm text-emerald-900/70 shadow-sm">
          ログイン画面を準備しています...
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
