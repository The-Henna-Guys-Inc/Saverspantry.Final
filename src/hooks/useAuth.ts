import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener FIRST (per Lovable Cloud guidance), then getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // Auto-cancel any pending deletion when the user signs back in
      if (event === "SIGNED_IN" && s?.user) {
        const uid = s.user.id;
        setTimeout(async () => {
          const { data } = await supabase.from("account_deletion_requests")
            .select("id, cancelled_at, purged_at").eq("user_id", uid).maybeSingle();
          if (data && !data.cancelled_at && !data.purged_at) {
            await supabase.from("account_deletion_requests")
              .update({ cancelled_at: new Date().toISOString() }).eq("id", data.id);
            await supabase.from("profiles").update({ deletion_pending_at: null }).eq("user_id", uid);
          }
        }, 0);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
