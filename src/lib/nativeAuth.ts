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
  const hashedNonce = await sha256Hex(rawNonce);

  // Google does NOT hash the nonce — pass the hashed value so the id_token's
  // nonce claim equals SHA256(rawNonce), which is what Supabase compares against.
  // Apple's AuthenticationServices framework hashes the nonce internally before
  // signing — pass the RAW nonce so it isn't double-hashed.
  const loginRes = await SocialLogin.login({
    provider,
    options:
      provider === "google"
        ? { scopes: ["email", "profile"], nonce: hashedNonce }
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
