const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function sortByDistance<T extends { lat: number; lng: number }>(
  origin: { lat: number; lng: number },
  places: T[],
): Array<{ place: T; distanceKm: number }> {
  return places
    .map((place) => ({ place, distanceKm: haversineKm(origin, place) }))
    .sort((x, y) => x.distanceKm - y.distanceKm);
}
