// Geometry for THE MAP: equirectangular projection + great-circle scoring.

export interface LatLng {
  lat: number;
  lng: number;
}

// SVG viewBox is "0 0 360 180"; projection is linear (equirectangular).
export const project = (p: LatLng) => ({ x: p.lng + 180, y: 90 - p.lat });
export const unproject = (x: number, y: number): LatLng => ({
  lat: 90 - y,
  lng: x - 180,
});

const R = 6371; // earth radius, km

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 100 at 0 km, ~51 at 1,000 km, ~14 at 3,000 km — same 0-100 scale as The Clock. */
export function mapPoints(distanceKm: number): number {
  return Math.round(100 * Math.exp(-distanceKm / 1500));
}
