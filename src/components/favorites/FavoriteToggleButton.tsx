"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUBLIC_LOGIN_PATH } from "@/lib/config";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFavorites } from "@/hooks/useFavorites";

type Props = {
  spotId: number;
  isSample?: boolean;
};

/**
 * スポット詳細用のお気に入りトグル。
 *
 * @param props - 対象 spot id
 * @returns FavoriteToggleButton
 * @example
 * <FavoriteToggleButton spotId={12} />
 */
export function FavoriteToggleButton({ spotId, isSample = false }: Props) {
  const favorites = useFavorites();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const active = favorites.isFavorite(spotId);

  if (isSample) {
    return <Button variant="outline" className="mt-5" disabled>サンプル（保存対象外）</Button>;
  }

  if (favorites.isReady && !favorites.isAuthenticated) {
    return (
      <Link
        href={`${PUBLIC_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`}
        className="action-link action-link-secondary mt-5"
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
        ログインして保存
      </Link>
    );
  }

  return (
    <>
      <Button
        variant={active ? "primary" : "outline"}
        className="mt-5 inline-flex items-center gap-2"
        aria-pressed={active}
        disabled={
          !favorites.isReady ||
          favorites.loadFailed ||
          favorites.isMutating ||
          isPending
        }
        onClick={() => {
          startTransition(async () => {
            await favorites.toggleFavorite(spotId);
          });
        }}
      >
        <Heart
          className={`h-4 w-4 transition ${active ? "fill-current text-white" : "text-app-ink"}`}
        />
        {active ? "お気に入り済み" : "お気に入りに残す"}
      </Button>
      {favorites.error && (
        <p role="alert" className="text-sm text-app-danger">
          {favorites.error}
        </p>
      )}
    </>
  );
}
