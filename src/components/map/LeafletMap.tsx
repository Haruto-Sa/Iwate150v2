"use client";

import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DivIcon, Icon } from "leaflet";
import type { MarkerProps } from "react-leaflet";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { ConfirmedExternalLink } from "@/components/ui/ExternalNavigation";
import { Spot } from "@/lib/types";
import { getImageUrl } from "@/lib/storage";
import { useResolvedStorageUrls } from "@/lib/storageSignedClient";
import { getSpotHref } from "@/lib/spotRoutes";

const MapContainer = dynamic(
  async () => (await import("react-leaflet")).MapContainer,
  { ssr: false },
);
const TileLayer = dynamic(
  async () => (await import("react-leaflet")).TileLayer,
  {
    ssr: false,
  },
);
// 印とPopupを同時に読み込み、印だけ操作可能になる瞬間を作らない。
const MapMarker = dynamic<MarkerProps>(
  async () => {
    const { Marker, Popup } = await import("react-leaflet");
    /**
     * 印とその説明を同じロード境界で描画する。
     * @param props - 印の位置・表示設定と説明
     * @returns ポップアップ付きの印
     * @example <MapMarker position={[39.7, 141.1]}>説明</MapMarker>
     */
    function MapMarkerInner({ children, ...props }: MarkerProps) {
      return (
        <Marker {...props}>
          <Popup>{children}</Popup>
        </Marker>
      );
    }
    return MapMarkerInner;
  },
  { ssr: false },
);

type AutoFitMapViewProps = {
  points: Array<{ lat: number; lng: number }>;
  fitKey: string;
};

const AutoFitMapView = dynamic<AutoFitMapViewProps>(
  async () => {
    const { useMap } = await import("react-leaflet");
    const { latLngBounds } = await import("leaflet");

    /**
     * 表示対象ポイントに合わせて地図表示範囲を自動調整する。
     *
     * @param props - 自動フィット設定
     * @returns 描画要素なし
     */
    function AutoFitMapViewInner({ points, fitKey }: AutoFitMapViewProps) {
      const map = useMap();
      const pointsRef = useRef(points);

      useEffect(() => {
        pointsRef.current = points;
      }, [points]);

      useEffect(() => {
        const nextPoints = pointsRef.current;
        if (nextPoints.length === 0) return;

        if (nextPoints.length === 1) {
          const only = nextPoints[0];
          const targetZoom = Math.min(map.getMaxZoom() ?? 18, 14);
          map.setView([only.lat, only.lng], targetZoom, { animate: false });
          return;
        }

        const bounds = latLngBounds(
          nextPoints.map((point) => [point.lat, point.lng] as [number, number]),
        );
        map.fitBounds(bounds, {
          animate: false,
          padding: [24, 24],
          maxZoom: 14,
        });
      }, [fitKey, map]);

      return null;
    }

    return AutoFitMapViewInner;
  },
  { ssr: false },
);

type Props = {
  center: { lat: number; lng: number };
  zoom?: number;
  spots: Spot[];
  showUser?: boolean;
  showImages?: boolean;
  showDetailLinks?: boolean;
  visitedSpotIds?: number[];
  stampProgressKnown?: boolean;
  userPosition?: { lat: number; lng: number } | null;
  /** スポットへのルート検索リクエスト時に呼ばれるコールバック */
  onRouteRequest?: (
    destination: { lat: number; lng: number },
    trigger?: HTMLElement,
  ) => void;
};

/**
 * Leaflet 地図コンポーネント
 *
 * スポットマーカーの表示、ユーザー現在地表示、ルート検索導線を提供する。
 *
 * @param props.center - 地図中心座標
 * @param props.zoom - ズームレベル
 * @param props.spots - マーカー表示するスポット配列
 * @param props.showUser - ユーザー現在地マーカーの表示有無
 * @param props.showImages - ポップアップ画像の取得・表示有無
 * @param props.showDetailLinks - 実スポット詳細へのリンク表示有無
 * @param props.userPosition - ユーザー現在地座標
 * @param props.onRouteRequest - ルート検索リクエスト時のコールバック
 * @param props.visitedSpotIds - スタンプ表示時の取得済みID。指定時は専用の印を使う
 * @param props.stampProgressKnown - 本人の進捗が取得済みか
 * @returns LeafletMap コンポーネント
 * @example <LeafletMap center={center} spots={spots} showUser={false} visitedSpotIds={[]} />
 */
export function LeafletMap({
  center,
  zoom = 8,
  spots,
  showUser = true,
  showImages = true,
  showDetailLinks = true,
  userPosition,
  onRouteRequest,
  visitedSpotIds,
  stampProgressKnown = false,
}: Props) {
  const markers = useMemo(() => spots ?? [], [spots]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [defaultIcon, setDefaultIcon] = useState<Icon | null>(null);
  const [stampIcons, setStampIcons] = useState<{
    target: DivIcon;
    earned: DivIcon;
  } | null>(null);
  const [userIcon, setUserIcon] = useState<DivIcon | null>(null);
  const centerKey = `${center.lat.toFixed(6)}:${center.lng.toFixed(6)}`;
  const markerImagePaths = useMemo(
    () =>
      showImages
        ? markers.map(
            (spot) => spot.image_thumb_path ?? spot.image_path ?? null,
          )
        : [],
    [markers, showImages],
  );
  const resolvedImageMap = useResolvedStorageUrls(markerImagePaths, "image");

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then(({ Icon, divIcon }) => {
      if (cancelled) return;
      setStampIcons({
        target: divIcon({
          className: "stamp-map-marker",
          html: '<span style="display:grid;place-items:center;width:30px;height:30px;border:2px solid #205442;border-radius:50%;background:#fff;color:#205442;font-size:20px">○</span>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        earned: divIcon({
          className: "stamp-map-marker",
          html: '<span style="display:grid;place-items:center;width:30px;height:30px;border:2px solid #fff;border-radius:50%;background:#205442;color:#fff;font-size:20px">✓</span>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      });
      setDefaultIcon(
        new Icon({
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        }),
      );
      setUserIcon(
        divIcon({
          className: "user-marker",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#e53935;box-shadow:0 0 0 6px rgba(229,57,53,0.25);border:2px solid white;"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (userPosition) {
      // 親から現在地が渡された場合はその値を優先表示する。
      setUserPos(userPosition);
      return;
    }
    if (!showUser || typeof navigator === "undefined" || !navigator.geolocation)
      return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // silently ignore
      },
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }, [showUser, userPosition]);

  const markerPointsKey = useMemo(
    () =>
      markers
        .map(
          (spot) => `${spot.id}:${spot.lat.toFixed(6)}:${spot.lng.toFixed(6)}`,
        )
        .join("|"),
    [markers],
  );
  const fitUserPos = useMemo(
    () => (userPos ? { lat: userPos.lat, lng: userPos.lng } : null),
    [userPos],
  );
  const fitKey = useMemo(
    () => `${markerPointsKey}|user:${showUser && fitUserPos ? "1" : "0"}`,
    [fitUserPos, markerPointsKey, showUser],
  );
  const fitPoints = useMemo(() => {
    const points = markers.map((spot) => ({ lat: spot.lat, lng: spot.lng }));
    if (showUser && fitUserPos) {
      points.push(fitUserPos);
    }
    return points;
  }, [fitUserPos, markers, showUser]);

  return (
    <div className="relative z-0 isolate h-[60vh] w-full overflow-hidden rounded-2xl border border-white/10 shadow-xl ring-1 ring-white/10">
      <MapContainer
        key={centerKey}
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
        <AutoFitMapView points={fitPoints} fitKey={fitKey} />
        {markers.map((spot) => {
          const imagePath = showImages
            ? (spot.image_thumb_path ?? spot.image_path ?? null)
            : null;
          const imageUrl = imagePath
            ? (resolvedImageMap.get(imagePath) ?? getImageUrl(imagePath))
            : null;
          const stampStatus =
            visitedSpotIds === undefined
              ? null
              : stampProgressKnown && visitedSpotIds.includes(spot.id)
                ? "取得済み"
                : "対象スポット";
          const icon =
            stampStatus && stampIcons
              ? stampStatus === "取得済み"
                ? stampIcons.earned
                : stampIcons.target
              : defaultIcon;
          return (
            <MapMarker
              // Leafletのtitleは生成時設定なので、取得状態が変わった印を作り直す。
              key={`${spot.id}:${stampStatus ?? "spot"}`}
              position={[spot.lat, spot.lng]}
              title={`${spot.name}${stampStatus ? `（${stampStatus}）` : ""}`}
              zIndexOffset={stampStatus === "取得済み" ? 1000 : 0}
              {...(icon ? { icon } : {})}
            >
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{spot.name}</p>
                {stampStatus && <p>{stampStatus}</p>}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={spot.name}
                    className="h-20 w-full rounded-lg object-cover"
                  />
                )}
                {spot.reference_url && (
                  <ConfirmedExternalLink
                    className="text-emerald-600 underline underline-offset-2"
                    href={spot.reference_url}
                  >
                    関連リンク
                  </ConfirmedExternalLink>
                )}
                <div className="flex items-center gap-2">
                  {showDetailLinks && (
                    <a
                      className="text-emerald-700 underline text-sm"
                      href={getSpotHref(spot)}
                    >
                      詳細を見る
                    </a>
                  )}
                  {onRouteRequest && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(event) =>
                        onRouteRequest(
                          { lat: spot.lat, lng: spot.lng },
                          event.currentTarget,
                        )
                      }
                    >
                      ルート検索
                    </Button>
                  )}
                </div>
              </div>
            </MapMarker>
          );
        })}
        {userPos && userIcon && (
          <MapMarker position={[userPos.lat, userPos.lng]} icon={userIcon}>
            <div className="text-sm font-semibold text-emerald-700">現在地</div>
          </MapMarker>
        )}
      </MapContainer>
    </div>
  );
}
