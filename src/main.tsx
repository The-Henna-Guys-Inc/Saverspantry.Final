import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);
