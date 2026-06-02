import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// iOS Google OAuth client (from Google Cloud → iOS client)
const IOS_GOOGLE_CLIENT_ID =
  "358460982851-k8dg8hi3urmidh5v86eku6cbcuqtca5o.apps.googleusercontent.com";

let initPromise: Promise<void> | null = null;

async function ensureInit() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({
      google: { iOSClientId: IOS_GOOGLE_CLIENT_ID },
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
  const googleNonce = provider === "google" ? await sha256Hex(rawNonce) : rawNonce;

  // Google Sign-In on iOS expects the SHA-256 digest of the raw nonce and puts
  // that digest in the id_token. Supabase expects the original raw nonce and
  // hashes it once during verification. We also force an interactive Google
  // prompt so iOS doesn't restore an older cached token with a stale nonce.
  const loginRes = await SocialLogin.login({
    provider,
    options:
      provider === "google"
        ? { scopes: ["email", "profile"], nonce: googleNonce, forcePrompt: true }
        : { scopes: ["email", "name"], nonce: rawNonce },
  } as any);

  const idToken: string | null | undefined = (loginRes as any)?.result?.idToken;
  if (!idToken) {
    throw new Error(`Native ${provider} sign-in did not return an idToken`);
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider,
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}
