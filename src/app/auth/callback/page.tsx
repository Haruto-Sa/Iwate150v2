import { redirect } from "next/navigation";

/**
 * 旧 Supabase OAuth コールバックをログインページへ戻す。
 *
 * @returns never
 * @example
 * <LegacyAuthCallbackPage />
 */
export default function LegacyAuthCallbackPage() {
  redirect("/login");
}
