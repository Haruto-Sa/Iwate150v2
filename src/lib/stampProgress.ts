import type { City, Spot, Stamp } from "./types";

export const STAMP_RADIUS_METERS = 200;

/**
 * 地図と収集の対象にできる座標かを検証する。
 * @param point - 緯度経度
 * @returns 有限で地理座標の範囲内ならtrue
 * @example isStampLocation({ lat: 39.7, lng: 141.1 });
 */
export function isStampLocation(point: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(point.lat) &&
    Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lng) <= 180
  );
}

/**
 * 公開対象スポットと本人の取得記録を突き合わせ、市町村別進捗を作る。
 * @param spots - 表示対象スポット
 * @param cities - 公開市町村
 * @param stamps - 本人記録。未取得時は空を渡し、UIで未確認を明示する
 * @returns 重複と対象外記録を除いた進捗。対象未登録の自治体も残す
 * @example buildStampProgress(spots, cities, stamps);
 */
export function buildStampProgress(
  spots: Spot[],
  cities: City[],
  stamps: Stamp[],
) {
  const targets = [
    ...new Map(
      spots.filter(isStampLocation).map((spot) => [spot.id, spot]),
    ).values(),
  ];
  const targetIds = new Set(targets.map((spot) => spot.id));
  const earnedIds = new Set(
    stamps.map((stamp) => stamp.spot_id).filter((id) => targetIds.has(id)),
  );
  const cityMap = new Map(cities.map((city) => [city.id, city]));
  for (const spot of targets) {
    if (!cityMap.has(spot.city_id))
      cityMap.set(spot.city_id, {
        id: spot.city_id,
        name: "市町村情報を確認中",
      });
  }
  const groups = [...cityMap.values()].map((city) => {
    const citySpots = targets.filter((spot) => spot.city_id === city.id);
    const earned = citySpots.filter((spot) => earnedIds.has(spot.id)).length;
    return { city, spots: citySpots, earned, total: citySpots.length };
  });
  return {
    targets,
    earnedIds,
    groups,
    earned: earnedIds.size,
    total: targets.length,
    visitedCities: groups.filter((group) => group.earned > 0).length,
    targetCities: groups.filter((group) => group.total > 0).length,
    unavailableCount: new Set(
      stamps
        .filter((stamp) => !targetIds.has(stamp.spot_id))
        .map((stamp) => stamp.spot_id),
    ).size,
  };
}

/**
 * 操作時の現在地を取得する。ブラウザが応答しない場合も時間を制限する。
 * @returns 座標と推定精度。拒否・タイムアウトは利用者向けのエラー
 * @example const position = await locateForStamp();
 */
export function locateForStamp(): Promise<{
  lat: number;
  lng: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          "このブラウザは位置情報に対応していません。地図から対象を確認できます。",
        ),
      );
      return;
    }
    const timer = window.setTimeout(
      () =>
        reject(
          new Error(
            "位置情報の取得がタイムアウトしました。もう一度お試しください。",
          ),
        ),
      12000,
    );
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        const result = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        if (
          !isStampLocation(result) ||
          !Number.isFinite(result.accuracy) ||
          result.accuracy < 0
        ) {
          reject(
            new Error(
              "位置情報を確認できませんでした。もう一度取得してください。",
            ),
          );
        } else resolve(result);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(
          new Error(
            error.code === 1
              ? "位置情報が許可されていません。ブラウザ設定で許可すると収集できます。地図と対象一覧はそのまま閲覧できます。"
              : "位置情報を取得できませんでした。電波の届く場所で、もう一度お試しください。",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}
