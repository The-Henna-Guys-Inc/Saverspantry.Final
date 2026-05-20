export const NATIVE_OAUTH_SCHEME = "com.saverspantry.app";
export const NATIVE_OAUTH_REDIRECT_URI = `${NATIVE_OAUTH_SCHEME}://auth`;
export const NATIVE_OAUTH_STATE_KEY = "sp_native_oauth_state";
export const WEB_OAUTH_ORIGIN = "https://www.saverspantry.com";

const createState = () => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

const readHashParams = (hash: string) =>
  new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

export const createNativeOAuthUrl = (provider: "google" | "apple") => {
  const state = createState();
  sessionStorage.setItem(NATIVE_OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    provider,
    redirect_uri: NATIVE_OAUTH_REDIRECT_URI,
    state,
  });

  return `${WEB_OAUTH_ORIGIN}/~oauth/initiate?${params.toString()}`;
};

export const readReturnedOAuthState = (url: URL) =>
  url.searchParams.get("state") ?? readHashParams(url.hash).get("state");

export const readOAuthErrorFromUrl = (url: URL) => ({
  error: url.searchParams.get("error") ?? readHashParams(url.hash).get("error"),
  errorDescription:
    url.searchParams.get("error_description") ??
    readHashParams(url.hash).get("error_description"),
});

export const readOAuthTokensFromUrl = (url: URL) => {
  const hashParams = readHashParams(url.hash);

  return {
    access_token: hashParams.get("access_token"),
    refresh_token: hashParams.get("refresh_token"),
  };
};

export const hasExpectedNativeOAuthState = (returnedState: string | null) => {
  const expectedState = sessionStorage.getItem(NATIVE_OAUTH_STATE_KEY);
  if (!expectedState || !returnedState) return true;
  return expectedState === returnedState;
};

export const clearNativeOAuthState = () => {
  sessionStorage.removeItem(NATIVE_OAUTH_STATE_KEY);
};