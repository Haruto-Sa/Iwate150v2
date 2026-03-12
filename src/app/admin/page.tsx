import { redirect } from "next/navigation";

/**
 * 旧管理画面 URL を新しい secret workspace へ転送する。
 *
 * @returns never
 * @example
 * <LegacyAdminPage />
 */
export default function LegacyAdminPage() {
  redirect("/studio");
}
