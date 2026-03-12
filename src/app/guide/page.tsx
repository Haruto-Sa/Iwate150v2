import { permanentRedirect } from "next/navigation";
import { CHARACTER_PATH } from "@/lib/config";

/**
 * 旧 Guide ルートを Character に恒久リダイレクトする。
 *
 * @returns なし
 * @example
 * return GuideRedirectPage();
 */
export default function GuideRedirectPage() {
  permanentRedirect(CHARACTER_PATH);
}
