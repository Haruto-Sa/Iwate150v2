import { haversineDistance } from "./geo";

export type BoundaryPoint = [lng: number, lat: number];
export type BoundaryPolygon = {
  bounds: [west: number, south: number, east: number, north: number];
  rings: BoundaryPoint[][];
};
export type MunicipalityBoundary = { code: string; name: string; polygons: BoundaryPolygon[] };
export type MunicipalBoundaryData = { version: 1; municipalities: MunicipalityBoundary[] };
export type MunicipalityLocation =
  | { status: "invalid" | "outside" }
  | { status: "boundary" | "ambiguous"; codes: string[] }
  | { status: "inside"; code: string; name: string; boundaryDistanceMeters: number };

// 浮動小数点演算の境界一致判定だけに使う。GPSや原典の位置誤差とは別。
const COORDINATE_EPSILON = 1e-10;

/**
 * 点と線分の最近点を求める。経度は観測緯度で補正して局所平面へ投影する。
 * @param point - 経度、緯度
 * @param a - 線分の始点
 * @param b - 線分の終点
 * @returns 線分上の最近点（短距離用近似）
 * @example nearestOnSegment([141, 39], [140, 39], [142, 39]);
 */
function nearestOnSegment(point: BoundaryPoint, a: BoundaryPoint, b: BoundaryPoint): BoundaryPoint {
  const xScale = Math.cos(point[1] * Math.PI / 180);
  const dx = (b[0] - a[0]) * xScale;
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - a[0]) * xScale * dx + (point[1] - a[1]) * dy) / lengthSquared,
  ));
  return [a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])];
}

/**
 * 閉じたリングへの包含を判定し、境界は内側と区別する。向きには依存しない。
 * @param point - 経度、緯度
 * @param ring - 先頭と末尾が等しいリング
 * @returns 内外、境界への近似距離
 * @example classifyRing([141, 39], ring);
 */
function classifyRing(point: BoundaryPoint, ring: BoundaryPoint[]): { inside: boolean; boundary: boolean; distance: number } {
  let inside = false;
  let boundary = false;
  let distance = Infinity;
  for (let index = 1; index < ring.length; index += 1) {
    const a = ring[index - 1];
    const b = ring[index];
    const nearest = nearestOnSegment(point, a, b);
    if (Math.hypot(nearest[0] - point[0], nearest[1] - point[1]) <= COORDINATE_EPSILON) boundary = true;
    distance = Math.min(distance, haversineDistance(point[1], point[0], nearest[1], nearest[0]));
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < a[0] + (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1])) inside = !inside;
  }
  return { inside, boundary, distance };
}

/**
 * 行政区域ポリゴンから自治体を求める。島・穴を保持し、共有境界で一方を選ばない。
 * この結果はデータ上の包含であり、スタンプ取得許可や測位精度の判定ではない。
 * @param point - 緯度・経度。範囲外や非有限値はinvalid
 * @param data - 検証済みの閉じた行政区域データ
 * @returns 内側の自治体と境界距離、境界/重複、区域外、または入力不正
 * @example locateMunicipality({ lat: 39.7, lng: 141.15 }, data);
 */
export function locateMunicipality(point: { lat: number; lng: number }, data: MunicipalBoundaryData): MunicipalityLocation {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return { status: "invalid" };
  const coordinate: BoundaryPoint = [point.lng, point.lat];
  const interiors: Array<{ code: string; name: string; distance: number }> = [];
  const boundaries = new Set<string>();
  for (const municipality of data.municipalities) {
    let distance = Infinity;
    for (const polygon of municipality.polygons) {
      const [west, south, east, north] = polygon.bounds;
      if (point.lng < west - COORDINATE_EPSILON || point.lng > east + COORDINATE_EPSILON || point.lat < south - COORDINATE_EPSILON || point.lat > north + COORDINATE_EPSILON) continue;
      const outer = classifyRing(coordinate, polygon.rings[0]);
      if (outer.boundary) boundaries.add(municipality.code);
      if (!outer.inside && !outer.boundary) continue;
      let inHole = false;
      let polygonDistance = outer.distance;
      for (const hole of polygon.rings.slice(1)) {
        const result = classifyRing(coordinate, hole);
        if (result.boundary) boundaries.add(municipality.code);
        if (result.inside || result.boundary) inHole = true;
        polygonDistance = Math.min(polygonDistance, result.distance);
      }
      if (outer.inside && !outer.boundary && !inHole) distance = Math.min(distance, polygonDistance);
    }
    if (Number.isFinite(distance)) interiors.push({ code: municipality.code, name: municipality.name, distance });
  }
  if (boundaries.size) return { status: "boundary", codes: [...new Set([...boundaries, ...interiors.map(item => item.code)])].sort() };
  if (interiors.length > 1) return { status: "ambiguous", codes: interiors.map(item => item.code).sort() };
  if (!interiors.length) return { status: "outside" };
  const match = interiors[0];
  return { status: "inside", code: match.code, name: match.name, boundaryDistanceMeters: match.distance };
}
