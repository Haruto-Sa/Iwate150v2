"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFavorites } from "@/hooks/useFavorites";

type Props = {
  spotId: number;
};

/**
 * スポット詳細用のお気に入りトグル。
 *
 * @param props - 対象 spot id
 * @returns FavoriteToggleButton
 * @example
 * <FavoriteToggleButton spotId={12} />
 */
export function FavoriteToggleButton({ spotId }: Props) {
  const favorites = useFavorites();
  const [isPending, startTransition] = useTransition();
  const [pulse, setPulse] = useState(false);
  const active = favorites.isFavorite(spotId);

  return (
    <Button
      variant={active ? "primary" : "outline"}
      className={`mt-5 inline-flex items-center gap-2 ${pulse ? "scale-105" : ""}`}
      disabled={!favorites.isReady || isPending}
      onClick={() => {
        setPulse(true);
        startTransition(async () => {
          await favorites.toggleFavorite(spotId);
          window.setTimeout(() => setPulse(false), 220);
        });
      }}
    >
      <Heart className={`h-4 w-4 transition ${active ? "fill-current text-white" : "text-emerald-900"}`} />
      {active ? "お気に入り済み" : "お気に入りに残す"}
    </Button>
  );
}
