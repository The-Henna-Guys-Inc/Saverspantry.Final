import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const LAST_ACTIVITY_KEY = "tp_last_activity";
const SESSION_START_KEY = "tp_session_start";

export const SessionEnforcer = () => {
  const { user, session } = useAuth();
  const settingsRef = useRef<{ session_max_hours: number; idle_timeout_minutes: number }>({
    session_max_hours: 720,
    idle_timeout_minutes: 60,
  });

  // Load settings
  useEffect(() => {
    if (!user) return;
    supabase.from("admin_session_settings").select("session_max_hours, idle_timeout_minutes").maybeSingle()
      .then(({ data }) => { if (data) settingsRef.current = data; });
  }, [user]);

  // Track session start
  useEffect(() => {
    if (!session) {
      localStorage.removeItem(SESSION_START_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return;
    }
    if (!localStorage.getItem(SESSION_START_KEY)) {
      localStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }, [session]);

  // Track activity
  useEffect(() => {
    if (!user) return;
    const bump = () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
  }, [user]);

  // Periodic check
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const start = parseInt(localStorage.getItem(SESSION_START_KEY) ?? "0");
      const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) ?? "0");
      const now = Date.now();
      const { session_max_hours, idle_timeout_minutes } = settingsRef.current;
      const maxAgeMs = session_max_hours * 3600 * 1000;
      const idleMs = idle_timeout_minutes * 60 * 1000;
      let reason: string | null = null;
      if (start && now - start > maxAgeMs) reason = "Session expired. Please sign in again.";
      else if (last && now - last > idleMs) reason = "Signed out due to inactivity.";
      if (reason) {
        await supabase.auth.signOut();
        localStorage.removeItem(SESSION_START_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        toast.info(reason);
      }
    };
    const id = setInterval(check, 30_000);
    check();
    return () => clearInterval(id);
  }, [user]);

  return null;
};
