// Feature flags. Flip these to roll a feature out to all users.
//
// DEALS_LAUNCHED — set to `true` once the deals data is loaded and we're
// ready to expose the Deals tabs to everyone. While `false`, regular users
// see a "Launching soon" gate; admins always see the real page so they can
// keep loading data behind the scenes.
export const DEALS_LAUNCHED = false;

// Target launch date used by the countdown on the gate. Adjust as needed.
// Defaults to 4 weeks from when this flag was last set.
export const DEALS_LAUNCH_DATE = new Date("2026-06-12T12:00:00-05:00");
