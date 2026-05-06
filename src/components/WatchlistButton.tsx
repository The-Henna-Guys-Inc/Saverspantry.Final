import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = { foodName: string; size?: "sm" | "icon" };

export const WatchlistButton = ({ foodName, size = "sm" }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!user || !foodName) return;
    supabase
      .from("watchlist_items")
      .select("id")
      .eq("user_id", user.id)
      .ilike("food_name", foodName.trim())
      .maybeSingle()
      .then(({ data }) => setWatching(!!data));
  }, [user, foodName]);

  const toggle = async () => {
    if (!user) {
      toast.info("Sign in to watch for sales");
      navigate("/auth");
      return;
    }
    setBusy(true);
    if (watching) {
      const { error } = await supabase
        .from("watchlist_items")
        .delete()
        .eq("user_id", user.id)
        .ilike("food_name", foodName.trim());
      setBusy(false);
      if (error) return toast.error(error.message);
      setWatching(false);
      toast.success("Removed from watchlist");
    } else {
      const { error } = await supabase
        .from("watchlist_items")
        .insert({ user_id: user.id, food_name: foodName.trim().toLowerCase() });
      setBusy(false);
      if (error) return toast.error(error.message);
      setWatching(true);
      toast.success("We'll surface sales for this");
    }
  };

  return (
    <Button onClick={toggle} disabled={busy} variant="outline" size={size === "icon" ? "icon" : "sm"} className="rounded-xl">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : watching ? <BellRing className="h-3.5 w-3.5 fill-current" /> : <Bell className="h-3.5 w-3.5" />}
      {size !== "icon" && <span className="ml-1.5">{watching ? "Watching" : "Watch sales"}</span>}
    </Button>
  );
};
