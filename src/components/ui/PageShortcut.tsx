import Link from "next/link";
import { Heart, Sparkles, ArrowRight } from "lucide-react";
import { CHARACTER_PATH, FAVORITES_PATH } from "@/lib/config";

/**
 * 体験画面から関連ページへ移動する内部リンク。
 * @param props.target - キャラクターまたはお気に入り
 * @returns ログイン状態を問わず利用できるページ導線
 * @example <PageShortcut target="favorites" />
 */
export function PageShortcut({ target }: { target: "character" | "favorites" }) {
  const isCharacter = target === "character";
  const Icon = isCharacter ? Sparkles : Heart;
  return (
    <Link
      href={isCharacter ? CHARACTER_PATH : FAVORITES_PATH}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-900/15 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {isCharacter ? "キャラクターを見る" : "お気に入りを見る"}
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
    </Link>
  );
}
