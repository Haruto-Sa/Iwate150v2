"use client";

import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Icon, divIcon } from "leaflet";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Spot } from "@/lib/types";
import { getImageUrl } from "@/lib/storage";
import { useResolvedStorageUrls } from "@/lib/storageSignedClient";

const MapContainer = dynamic(
  async () => (await import("react-leaflet")).MapContainer,
  { ssr: false }
);
const TileLayer = dynamic(async () => (await import("react-leaflet")).TileLayer, {
  ssr: false,
});
const Marker = dynamic(async () => (await import("react-leaflet")).Marker, {
  ssr: false,
});
const Popup = dynamic(async () => (await import("react-leaflet")).Popup, {
  ssr: false,
});

type Props = {
  center: { lat: number; lng: number };
  zoom?: number;
  spots: Spot[];
  showUser?: boolean;
  userPosition?: { lat: number; lng: number } | null;
  /** スポットへのルート検索リクエスト時に呼ばれるコールバック */
  onRouteRequest?: (destination: { lat: number; lng: number }) => void;
};

const defaultIcon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const userIcon = divIcon({
  className: "user-marker",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#e53935;box-shadow:0 0 0 6px rgba(229,57,53,0.25);border:2px solid white;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/**
 * Leaflet 地図コンポーネント
 *
 * スポットマーカーの表示、ユーザー現在地表示、ルート検索導線を提供する。
 *
 * @param props.center - 地図中心座標
 * @param props.zoom - ズームレベル
 * @param props.spots - マーカー表示するスポット配列
 * @param props.showUser - ユーザー現在地マーカーの表示有無
 * @param props.userPosition - ユーザー現在地座標
 * @param props.onRouteRequest - ルート検索リクエスト時のコールバック
 * @returns LeafletMap コンポーネント
 */
export function LeafletMap({
  center,
  zoom = 8,
  spots,
  showUser = true,
  userPosition,
  onRouteRequest,
}: Props) {
  const markers = useMemo(() => spots ?? [], [spots]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const centerKey = `${center.lat.toFixed(6)}:${center.lng.toFixed(6)}`;
  const markerImagePaths = useMemo(
    () => markers.map((spot) => spot.image_thumb_path ?? spot.image_path ?? null),
    [markers]
  );
  const resolvedImageMap = useResolvedStorageUrls(markerImagePaths, "image");

  useEffect(() => {
    if (userPosition) {
      setUserPos(userPosition);
      return;
    }
    if (!showUser || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // silently ignore
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [showUser, userPosition]);

  return (
    <div className="h-[60vh] w-full overflow-hidden rounded-2xl border border-white/10 shadow-xl ring-1 ring-white/10">
      <MapContainer
        key={centerKey}
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
        {markers.map((spot) => {
          const imagePath = spot.image_thumb_path ?? spot.image_path ?? null;
          const imageUrl = imagePath
            ? (resolvedImageMap.get(imagePath) ?? getImageUrl(imagePath))
            : null;
          return (
            <Marker
              key={spot.id}
              position={[spot.lat, spot.lng]}
              icon={defaultIcon}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{spot.name}</p>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={spot.name}
                      className="h-20 w-full rounded-lg object-cover"
                    />
                  )}
                  {spot.reference_url && (
                    <a
                      className="text-emerald-600 underline underline-offset-2"
                      href={spot.reference_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      関連リンク
                    </a>
                  )}
                  <div className="flex items-center gap-2">
                    <a
                      className="text-emerald-700 underline text-sm"
                      href={`/spot?focus=${spot.id}`}
                    >
                      詳細を見る
                    </a>
                    {onRouteRequest && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onRouteRequest({ lat: spot.lat, lng: spot.lng })}
                      >
                        ルート検索
                      </Button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        {userPos && (
          <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
            <Popup>
              <div className="text-sm font-semibold text-emerald-700">現在地</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
