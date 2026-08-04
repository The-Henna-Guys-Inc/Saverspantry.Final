// Feature flags. Flip these to roll a feature out to all users.

// DEALS_FEATURE_ENABLED — master kill-switch for the entire Deals feature
// (Deals tab, /deals + /sales routes, deal copy, waitlist, watchlist deal
// surfacing). Set to `false` for the v1.0 App Store launch.
//
// To re-enable in v1.1: set this to `true`, rebuild, resubmit.
// See docs/DEALS_FEATURE_FLAG.md for details.
//
// NOTE: admin pages (/admin/deals, /admin/flyer-sources) are intentionally
// NOT gated by this flag so we can keep curating deals internally.
export const DEALS_FEATURE_ENABLED = false;

// DEALS_LAUNCHED — legacy soft-launch gate, kept for compatibility.
export const DEALS_LAUNCHED = false;

// Target launch date used by the countdown on the gate. Adjust as needed.
export const DEALS_LAUNCH_DATE = new Date("2026-06-12T12:00:00-05:00");
