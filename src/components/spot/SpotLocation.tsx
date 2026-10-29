"use client";

import Link from "next/link";
import { MapPin, Navigation } from "lucide-react";
import { LeafletMap } from "@/components/map/LeafletMap";
import { ConfirmedExternalLink } from "@/components/ui/ExternalNavigation";
import { buildGoogleMapsUrl } from "@/lib/routeProviders";
import type { Spot } from "@/lib/types";

/**
 * 現在地を要求せず所在地を表示し、地図障害時も移動先を選べる。
 * @param props - 表示するスポット
 * @returns 所在地の地図と遷移操作
 * @example <SpotLocation spot={spot} />
 */
export function SpotLocation({ spot }: { spot: Spot }) {
  const route = buildGoogleMapsUrl({ lat: spot.lat, lng: spot.lng });

  return (
    <section aria-label="所在地" className="space-y-3">
      <h2 className="text-lg font-semibold text-emerald-950">所在地</h2>
      {route.ok ? (
        <LeafletMap center={{ lat: spot.lat, lng: spot.lng }} spots={[spot]} showUser={false} showImages={false} showDetailLinks={false} embedded />
      ) : (
        <p role="status" className="text-sm text-emerald-900">所在地を確認できません。</p>
      )}
      <div className="flex flex-wrap gap-3">
        {route.ok && (
          <>
            <Link href={`/map?focus=${spot.id}`} className="action-link action-link-secondary">
              <MapPin className="h-4 w-4" aria-hidden="true" />地図を広げる
            </Link>
            <ConfirmedExternalLink href={route.url} className="action-link">
              <Navigation className="h-4 w-4" aria-hidden="true" />ルート検索
            </ConfirmedExternalLink>
          </>
        )}
        {spot.reference_url && (
          <ConfirmedExternalLink href={spot.reference_url} className="action-link action-link-secondary">関連サイトを見る</ConfirmedExternalLink>
        )}
      </div>
    </section>
  );
}
