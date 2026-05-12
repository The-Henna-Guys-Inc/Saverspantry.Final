// Haversine distance in miles between two lat/lng points.
export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// In-memory cache for ZIP geocoding (session lifetime).
const zipCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeZip(
  zip: string,
): Promise<{ lat: number; lng: number } | null> {
  const clean = (zip || "").trim();
  if (!/^\d{5}$/.test(clean)) return null;
  if (zipCache.has(clean)) return zipCache.get(clean)!;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${clean}`);
    if (!res.ok) {
      zipCache.set(clean, null);
      return null;
    }
    const json = await res.json();
    const place = json?.places?.[0];
    if (!place) {
      zipCache.set(clean, null);
      return null;
    }
    const out = {
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
    };
    zipCache.set(clean, out);
    return out;
  } catch {
    zipCache.set(clean, null);
    return null;
  }
}

export function formatDistance(mi: number | null | undefined): string {
  if (mi == null || !isFinite(mi)) return "";
  if (mi < 0.1) return "<0.1 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}
