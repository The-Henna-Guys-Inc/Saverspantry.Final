// Where Saver's Pantry is currently live. Add cities here when we expand.
import { distanceMiles } from "./distance";

export type LaunchCity = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMi: number;
};

export const LAUNCH_CITIES: LaunchCity[] = [
  { id: "chicagoland", name: "Chicagoland", lat: 41.88, lng: -87.63, radiusMi: 40 },
  { id: "peoria", name: "Peoria, IL", lat: 40.6936, lng: -89.589, radiusMi: 25 },
  { id: "bloomington", name: "Bloomington, IL", lat: 40.4842, lng: -88.9937, radiusMi: 25 },
  { id: "champaign", name: "Champaign, IL", lat: 40.1164, lng: -88.2434, radiusMi: 25 },
];

// Back-compat: a default headline label used in copy.
export const LAUNCH_CITY = "Illinois";

export function findLaunchCity(
  loc: { lat: number; lng: number } | null | undefined,
): LaunchCity | null {
  if (!loc) return null;
  for (const c of LAUNCH_CITIES) {
    if (distanceMiles(loc.lat, loc.lng, c.lat, c.lng) <= c.radiusMi) return c;
  }
  return null;
}

export function isInLaunchArea(
  loc: { lat: number; lng: number } | null | undefined,
): boolean {
  return findLaunchCity(loc) !== null;
}
