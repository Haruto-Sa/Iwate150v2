import { redirect } from "next/navigation";

/**
 * 旧管理ログイン URL を新しい入口へ転送する。
 *
 * @returns never
 * @example
 * <LegacyAdminLoginPage />
 */
export default function LegacyAdminLoginPage() {
  redirect("/studio/access");
}
