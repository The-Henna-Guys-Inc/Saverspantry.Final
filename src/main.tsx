import { createRoot } from "react-dom/client";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import App from "./App.tsx";
import "./index.css";
import {
  clearNativeOAuthState,
  hasExpectedNativeOAuthState,
  readOAuthErrorFromUrl,
  readOAuthTokensFromUrl,
  readReturnedOAuthState,
} from "@/lib/nativeAuth";

// Aggressively evict any previously-registered service worker BEFORE the
// app mounts. A prior SW shipped a broken fetch handler that crashed on
// Apple's OAuth POST callback (form_post response_mode) by double-cloning
// a consumed Response. Until every device has dropped that worker, we
// unregister on every load and nuke caches.
if ("serviceWorker" in navigator) {
  (async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const hadController = !!navigator.serviceWorker.controller;
      await Promise.all(registrations.map((r) => r.unregister()));
      if ("caches" in self) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // If a SW was controlling this page (i.e. the broken one may have
      // already intercepted the current navigation), force a clean reload
      // ONCE so subsequent requests bypass it. Guard with a sessionStorage
      // flag to avoid reload loops.
      if (hadController && !sessionStorage.getItem("__sw_evicted")) {
        sessionStorage.setItem("__sw_evicted", "1");
        location.reload();
        return;
      }
    } catch {
      // ignore
    }
  })();
}

if (Capacitor.isNativePlatform()) {
  void CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
    if (!url?.startsWith("com.saverspantry.app://auth")) return;

    try {
      const callbackUrl = new URL(url);
      const returnedState = readReturnedOAuthState(callbackUrl);

      if (!hasExpectedNativeOAuthState(returnedState)) {
        console.warn("[auth-debug] Native OAuth state mismatch", { url });
        clearNativeOAuthState();
        await Browser.close();
        return;
      }

      const { error, errorDescription } = readOAuthErrorFromUrl(callbackUrl);
      if (error) {
        console.warn("[auth-debug] Native OAuth returned error", {
          error,
          errorDescription,
          url,
        });
        clearNativeOAuthState();
        await Browser.close();
        return;
      }

      const { access_token, refresh_token } = readOAuthTokensFromUrl(callbackUrl);
      if (access_token && refresh_token) {
        console.log("[auth-debug] Native OAuth tokens received; setting session");
        await supabase.auth.setSession({ access_token, refresh_token });
      } else {
        console.warn("[auth-debug] Native OAuth callback missing tokens", { url });
      }
    } catch (error) {
      console.error("[auth-debug] Failed handling native OAuth callback", error);
    } finally {
      clearNativeOAuthState();
      await Browser.close();
      window.location.assign("/");
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
