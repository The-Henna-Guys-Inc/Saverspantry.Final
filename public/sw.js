// Kill-switch service worker.
// This file exists ONLY to evict any previously-installed service worker
// (which had a broken fetch handler that called .clone() on a consumed
// Response body and crashed the Apple OAuth POST callback to /welcome).
//
// It must NEVER intercept fetches. In particular, OAuth callback POSTs
// from Apple (response_mode=form_post) must pass straight through to the
// network, otherwise the body gets consumed and the redirect breaks.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      } finally {
        // Always unregister, even if cache cleanup throws.
        await self.registration.unregister();
      }
    })()
  );
});

// Explicit no-op fetch handler. Do NOT call event.respondWith — that would
// make this SW responsible for the response. By not responding, every
// request (including Apple's POST callback) goes straight to the network
// untouched. This also overrides any cached handler from a previous SW
// version the moment this one activates.
self.addEventListener("fetch", () => {
  // intentionally empty
});
