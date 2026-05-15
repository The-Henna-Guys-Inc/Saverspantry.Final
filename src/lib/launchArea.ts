// Where Saver's Pantry is currently live. Flip cities here when we expand.
import { distanceMiles } from "./distance";

export const LAUNCH_CITY = "Chicagoland";
export const LAUNCH_CENTER = { lat: 41.88, lng: -87.63 }; // downtown Chicago
export const LAUNCH_RADIUS_MI = 40;

export function isInLaunchArea(loc: { lat: number; lng: number } | null | undefined): boolean {
  if (!loc) return false;
  return distanceMiles(loc.lat, loc.lng, LAUNCH_CENTER.lat, LAUNCH_CENTER.lng) <= LAUNCH_RADIUS_MI;
}
