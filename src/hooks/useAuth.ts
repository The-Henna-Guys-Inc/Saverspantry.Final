import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const TAG = "[auth-debug]";

const getOAuthCallbackDetails = () => {
  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

    return {
      url,
      code: url.searchParams.get("code"),
      error: url.searchParams.get("error") ?? hash.get("error"),
      errorDescription:
        url.searchParams.get("error_description") ?? hash.get("error_description"),
      hasAccessToken: hash.has("access_token"),
      hasRefreshToken: hash.has("refresh_token"),
    };
  } catch {
    return {
      url: null,
      code: null,
      error: null,
      errorDescription: null,
      hasAccessToken: false,
      hasRefreshToken: false,
    };
  }
};

const stripOAuthParamsFromUrl = () => {
  try {
    const url = new URL(window.location.href);
    ["code", "state", "error", "error_code", "error_description"].forEach((key) => {
      url.searchParams.delete(key);
    });
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash ? "" : ""}`);
  } catch (e) {
    console.warn(TAG, "Failed to strip OAuth params from URL", e);
  }
};

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
    const callback = getOAuthCallbackDetails();

    // Log URL state on mount — OAuth callbacks land here with hash/code params
    try {
      console.log(TAG, "useAuth mount", {
        href: window.location.href,
        hash: window.location.hash,
        search: window.location.search,
        hasCode: !!callback.code,
        hasAccessToken: callback.hasAccessToken,
        hasRefreshToken: callback.hasRefreshToken,
        hasError: !!callback.error,
        error: callback.error,
        errorDescription: callback.errorDescription,
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

    (async () => {
      if (callback.code) {
        console.log(TAG, "OAuth code detected; exchanging for session", {
          pathname: callback.url?.pathname,
          search: callback.url?.search,
          codeLength: callback.code.length,
        });

        const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
        console.log(TAG, "exchangeCodeForSession resolved", {
          hasSession: !!data.session,
          userId: data.session?.user?.id,
          provider: data.session?.user?.app_metadata?.provider,
          errorCode: (error as any)?.code,
          errorMsg: error?.message,
        });

        if (!error) {
          stripOAuthParamsFromUrl();
        }
      }

      const { data: { session: s }, error } = await supabase.auth.getSession();
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
    })();
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
