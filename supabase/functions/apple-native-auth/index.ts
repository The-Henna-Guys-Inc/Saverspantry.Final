// Native iOS Apple Sign In bridge.
// iOS returns an Apple identity token whose `aud` is the app's bundle ID,
// which the standard Supabase Apple provider (configured with the web
// Services ID) will reject. This function verifies the token against
// Apple's JWKS with the bundle ID as the expected audience, then mints
// a Supabase session via the admin API.
//
// Web Apple sign-in is unaffected — it still goes through Lovable Cloud's
// managed Apple OAuth using the Services ID.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jwtVerify, createRemoteJWKSet, decodeJwt } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPLE_BUNDLE_ID = "com.saverspantry.app";
const APPLE_ISSUER = "https://appleid.apple.com";
const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idToken, rawNonce } = await req.json();
    if (!idToken) {
      return json({ error: "Missing idToken" }, 400);
    }

    // Verify Apple identity token: signature, issuer, audience (bundle ID), exp.
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: APPLE_ISSUER,
      audience: APPLE_BUNDLE_ID,
    });

    // Verify nonce matches (Apple stores the SHA-256 of rawNonce in the token).
    if (rawNonce) {
      const expected = await sha256Hex(rawNonce);
      if (payload.nonce && payload.nonce !== expected) {
        return json({ error: "Nonce mismatch" }, 401);
      }
    }

    const appleSub = payload.sub as string;
    const email = (payload.email as string) || `${appleSub}@privaterelay.appleid`;
    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find or create the user by email.
    let userId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const match = existing?.users.find(
      (u) =>
        u.email?.toLowerCase() === email.toLowerCase() ||
        u.user_metadata?.apple_sub === appleSub,
    );
    if (match) {
      userId = match.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: emailVerified,
        user_metadata: { provider: "apple", apple_sub: appleSub },
      });
      if (createErr) throw createErr;
      userId = created.user.id;
    }

    // Generate a magic-link token the client can exchange for a session.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) throw linkErr;

    return json({
      email,
      token_hash: (linkData as any).properties?.hashed_token,
      user_id: userId,
    });
  } catch (e) {
    console.error("apple-native-auth error", e);
    return json({ error: (e as Error).message || "Apple verification failed" }, 401);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
