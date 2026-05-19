import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const TAG = "[auth-debug]";
type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let authState: AuthState = {
  session: null,
  user: null,
  loading: true,
};

const listeners = new Set<(state: AuthState) => void>();
let initPromise: Promise<void> | null = null;

const emitAuthState = (next: AuthState) => {
  authState = next;
  listeners.forEach((listener) => listener(authState));
};

const setAuthSession = (session: Session | null, loading = false) => {
  emitAuthState({
    session,
    user: session?.user ?? null,
    loading,
  });
};

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

const cancelPendingDeletion = async (userId: string) => {
  const { data } = await supabase
    .from("account_deletion_requests")
    .select("id, cancelled_at, purged_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (data && !data.cancelled_at && !data.purged_at) {
    await supabase
      .from("account_deletion_requests")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", data.id);

    await supabase
      .from("profiles")
      .update({ deletion_pending_at: null })
      .eq("user_id", userId);
  }
};

const initializeAuth = () => {
  if (initPromise) return initPromise;

  const callback = getOAuthCallbackDetails();

  try {
    console.log(TAG, "useAuth init", {
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

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    console.log(TAG, "onAuthStateChange", {
      event,
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      provider: session?.user?.app_metadata?.provider,
      expiresAt: session?.expires_at,
      lastSignInAt: session?.user?.last_sign_in_at,
    });

    setAuthSession(session, false);

    if (event === "SIGNED_IN" && session?.user) {
      setTimeout(() => {
        void cancelPendingDeletion(session.user.id);
      }, 0);
    }
  });

  initPromise = (async () => {
    if (callback.error) {
      console.warn(TAG, "OAuth callback reported error", {
        error: callback.error,
        errorDescription: callback.errorDescription,
        pathname: callback.url?.pathname,
        search: callback.url?.search,
        hash: callback.url?.hash,
      });
    }

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
        errorCode: (error as { code?: string } | null)?.code,
        errorMsg: error?.message,
      });

      if (!error) {
        stripOAuthParamsFromUrl();
      }
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    console.log(TAG, "getSession resolved", {
      hasSession: !!session,
      userId: session?.user?.id,
      provider: session?.user?.app_metadata?.provider,
      errorCode: (error as { code?: string } | null)?.code,
      errorMsg: error?.message,
    });

    if (error?.code === "refresh_token_not_found") {
      await clearInvalidLocalSession();
      setAuthSession(null, false);
      return;
    }

    setAuthSession(session, false);
  })().catch((error) => {
    console.error(TAG, "initializeAuth failed", error);
    setAuthSession(null, false);
  });

  void subscription;
  return initPromise;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    const listener = (next: AuthState) => setState(next);
    listeners.add(listener);
    setState(authState);
    void initializeAuth();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}
