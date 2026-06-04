import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// iOS Google OAuth client (from Google Cloud → iOS client)
// Used by the native SDK to perform the on-device sign-in.
const IOS_GOOGLE_CLIENT_ID =
  "358460982851-k8dg8hi3urmidh5v86eku6cbcuqtca5o.apps.googleusercontent.com";

// Web Google OAuth client (from Google Cloud → Web application client)
// This MUST match the Google Client ID configured in Lovable Cloud.
// Passing it as the iOS "server client ID" makes Google issue an id_token
// whose `aud` is the web client — which is what Supabase verifies.
// Without this, native iOS tokens have aud=iOS client and Supabase rejects
// them whenever Lovable Cloud is configured with the web client ID.
const WEB_GOOGLE_CLIENT_ID =
  "358460982851-2a78s8md20rb65efh00cjvv58i7gvl1c.apps.googleusercontent.com";

let initPromise: Promise<void> | null = null;

async function ensureInit() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({
      google: {
        iOSClientId: IOS_GOOGLE_CLIENT_ID,
        iOSServerClientId: WEB_GOOGLE_CLIENT_ID,
      },
      // Apple on iOS uses the system AuthenticationServices framework — no clientId required.
      apple: {},
    });
  })().catch((e) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
}


function randomNonce(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function isNativeAuthAvailable() {
  return Capacitor.isNativePlatform();
}

export async function nativeSignIn(provider: "google" | "apple") {
  await ensureInit();
  const { SocialLogin } = await import("@capgo/capacitor-social-login");

  const rawNonce = randomNonce();
  const nativeNonce = await sha256Hex(rawNonce);

  // Native iOS Google and Apple sign-in both place the SHA-256 digest of the
  // nonce in the id_token. The backend still expects the original raw nonce
  // and hashes it once during verification, so we send the digest to iOS and
  // the raw value to signInWithIdToken(). Google also forces an interactive
  // prompt so iOS doesn't restore an older cached token with a stale nonce.
  const loginRes = await SocialLogin.login({
    provider,
    options:
      provider === "google"
        ? { scopes: ["email", "profile"], nonce: nativeNonce, forcePrompt: true }
        : { scopes: ["email", "name"], nonce: nativeNonce },
  } as any);

  const idToken: string | null | undefined = (loginRes as any)?.result?.idToken;
  if (!idToken) {
    throw new Error(`Native ${provider} sign-in did not return an idToken`);
  }

  if (provider === "apple") {
    // Native iOS Apple tokens have aud = bundle ID, which the Supabase Apple
    // provider (configured with the web Services ID) won't accept. Bridge
    // through our edge function which verifies the token against Apple's
    // JWKS with the bundle ID audience and returns a magic-link token_hash.
    const { data, error } = await supabase.functions.invoke("apple-native-auth", {
      body: { idToken, rawNonce },
    });
    if (error) throw error;
    if (!data?.token_hash || !data?.email) {
      throw new Error("Apple native auth bridge returned no token");
    }
    const { error: otpErr } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: data.token_hash,
    } as any);
    if (otpErr) throw otpErr;
    return;
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider,
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}
