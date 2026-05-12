import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { geocodeZip } from "@/lib/distance";

export type UserLocation = {
  lat: number;
  lng: number;
  source: "device" | "zip";
  label: string; // e.g. "ZIP 75201" or "Your location"
};

const PERM_KEY = "tp_loc_permission"; // 'granted' | 'denied' | 'prompt'

export function useUserLocation() {
  const { user } = useAuth();
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [zipCode, setZipCode] = useState<string | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<"granted" | "denied" | "prompt">(
    () => (typeof window !== "undefined" && (localStorage.getItem(PERM_KEY) as any)) || "prompt",
  );

  // Load profile zip + radius
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("zip_code, search_radius_miles")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setZipCode(data.zip_code ?? null);
        setRadiusMiles(data.search_radius_miles ?? 10);
      }
    })();
  }, [user]);

  // Resolve location: device first if previously granted, else zip
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (permission === "granted" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            setLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              source: "device",
              label: "Your location",
            });
            setLoading(false);
          },
          async () => {
            if (cancelled) return;
            // fall through to zip
            await resolveZip();
          },
          { maximumAge: 5 * 60 * 1000, timeout: 8000 },
        );
      } else {
        await resolveZip();
      }
      async function resolveZip() {
        if (zipCode) {
          const c = await geocodeZip(zipCode);
          if (cancelled) return;
          if (c) {
            setLocation({ lat: c.lat, lng: c.lng, source: "zip", label: `ZIP ${zipCode}` });
          } else {
            setLocation(null);
          }
        } else {
          setLocation(null);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permission, zipCode]);

  const requestPrecise = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem(PERM_KEY, "granted");
        setPermission("granted");
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "device",
          label: "Your location",
        });
      },
      () => {
        localStorage.setItem(PERM_KEY, "denied");
        setPermission("denied");
      },
    );
  }, []);

  const setManualZip = useCallback(
    async (zip: string) => {
      if (!user) return;
      const clean = zip.trim();
      if (!/^\d{5}$/.test(clean)) return;
      await supabase.from("profiles").update({ zip_code: clean }).eq("user_id", user.id);
      localStorage.setItem(PERM_KEY, "denied"); // user opted to use zip explicitly
      setPermission("denied");
      setZipCode(clean);
    },
    [user],
  );

  const setRadius = useCallback(
    async (miles: number) => {
      if (!user) return;
      await supabase.from("profiles").update({ search_radius_miles: miles }).eq("user_id", user.id);
      setRadiusMiles(miles);
    },
    [user],
  );

  return {
    location,
    zipCode,
    radiusMiles,
    permission,
    loading,
    requestPrecise,
    setManualZip,
    setRadius,
  };
}
