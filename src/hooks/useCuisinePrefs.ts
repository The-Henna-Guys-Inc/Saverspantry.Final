import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mapLegacyCuisines, type CuisineTag } from "@/lib/cuisineHints";

export function useCuisinePrefs() {
  const { user } = useAuth();
  const [cuisines, setCuisines] = useState<CuisineTag[]>([]);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("cuisine_preferences, cuisine_filter_enabled, dietary_prefs")
      .eq("user_id", user.id)
      .maybeSingle();
    let prefs = ((data?.cuisine_preferences ?? []) as string[]) as CuisineTag[];
    if (!prefs.length) {
      const legacy = (data?.dietary_prefs as any)?.cuisines as string[] | undefined;
      prefs = mapLegacyCuisines(legacy);
    }
    setCuisines(prefs);
    setFilterEnabled(data?.cuisine_filter_enabled ?? true);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const setPrefs = async (next: CuisineTag[]) => {
    if (!user) return;
    setCuisines(next);
    await supabase.from("profiles").update({ cuisine_preferences: next }).eq("user_id", user.id);
  };

  const setEnabled = async (on: boolean) => {
    if (!user) return;
    setFilterEnabled(on);
    await supabase.from("profiles").update({ cuisine_filter_enabled: on }).eq("user_id", user.id);
  };

  // Effective cuisines: empty list OR filter disabled => no filter applied.
  const activeCuisines: CuisineTag[] = filterEnabled ? cuisines : [];
  const isFiltering = filterEnabled && cuisines.length > 0;

  return { cuisines, filterEnabled, loading, setPrefs, setEnabled, refresh, activeCuisines, isFiltering };
}
