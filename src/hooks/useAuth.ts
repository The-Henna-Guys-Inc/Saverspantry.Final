import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const TAG = "[auth-debug]";

const clearInvalidLocalSession = async () => {
  console.warn(TAG, "clearInvalidLocalSession called");
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.warn(TAG, "Failed to clear invalid local session", error);
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Log URL state on mount — OAuth callbacks land here with hash/code params
    try {
      console.log(TAG, "useAuth mount", {
        href: window.location.href,
        hash: window.location.hash,
        search: window.location.search,
        hasCode: window.location.search.includes("code="),
        hasAccessToken: window.location.hash.includes("access_token"),
        hasError: window.location.hash.includes("error") || window.location.search.includes("error"),
      });
    } catch {}

    // Listener FIRST (per Lovable Cloud guidance), then getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log(TAG, "onAuthStateChange", {
        event,
        hasSession: !!s,
        userId: s?.user?.id,
        email: s?.user?.email,
        provider: s?.user?.app_metadata?.provider,
        expiresAt: s?.expires_at,
        lastSignInAt: s?.user?.last_sign_in_at,
      });
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
    supabase.auth.getSession().then(async ({ data: { session: s }, error }) => {
      console.log(TAG, "getSession resolved", {
        hasSession: !!s,
        userId: s?.user?.id,
        provider: s?.user?.app_metadata?.provider,
        errorCode: (error as any)?.code,
        errorMsg: error?.message,
      });
      if (error?.code === "refresh_token_not_found") {
        await clearInvalidLocalSession();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
