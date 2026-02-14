/**
 * Geolocation utilities
 */

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Sort spots by distance from a point
 */
export function sortByDistance<T extends { lat: number; lng: number }>(
  spots: T[],
  lat: number,
  lng: number
): (T & { distance: number })[] {
  return spots
    .map((spot) => ({
      ...spot,
      distance: haversineDistance(lat, lng, spot.lat, spot.lng),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Filter spots within radius
 * @param radius Radius in meters (default 200m)
 */
export function filterNearby<T extends { lat: number; lng: number }>(
  spots: T[],
  lat: number,
  lng: number,
  radius: number = 200
): (T & { distance: number })[] {
  return sortByDistance(spots, lat, lng).filter((s) => s.distance <= radius);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

