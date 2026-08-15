import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { DEALS_FEATURE_ENABLED } from "@/lib/featureFlags";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthResult = {
  data?: {
    client?: { name?: string; client_id?: string; redirect_uris?: string[] } | null;
    scope?: string;
    scopes?: string[];
    redirect_url?: string;
    redirect_to?: string;
  } | null;
  error?: { message: string } | null;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauthApi = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthResult["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      if (!oauthApi?.getAuthorizationDetails) {
        setError("OAuth is not enabled on this project yet.");
        return;
      }
      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data ?? null);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthApi.approveAuthorization(authorizationId)
      : await oauthApi.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(" ").filter(Boolean) : []);

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <BrandMark to="/" size="lg" />
        </div>
        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          {error ? (
            <div>
              <h1 className="text-xl font-bold text-primary mb-2">Could not load this request</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : !details ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading authorization request…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-xs uppercase tracking-widest text-accent font-semibold">
                  Authorize access
                </span>
              </div>
              <h1 className="text-2xl font-bold text-primary mb-1">
                Connect {clientName} to Saver's Pantry
              </h1>
              <p className="text-sm text-muted-foreground mb-4">
                {clientName} will be able to call this app's enabled tools while you are signed in.
              </p>

              <div className="rounded-xl bg-secondary/50 p-4 space-y-2 mb-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  This connection can:
                </div>
                <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
                  <li>Read your pantry items</li>
                  <li>Add items to your pantry (with your approval)</li>
                  {/* v1.1: restore when DEALS_FEATURE_ENABLED is true. */}
                  {DEALS_FEATURE_ENABLED && (
                    <>
                      <li>Read your favorite stores</li>
                      <li>Read your watchlist</li>
                      <li>Search current grocery deals</li>
                    </>
                  )}
                </ul>
                {scopes.length > 0 && (
                  <div className="pt-2 text-xs text-muted-foreground">
                    Identity: {scopes.join(", ")}
                  </div>
                )}
                <p className="pt-1 text-xs text-muted-foreground">
                  This does not bypass Saver's Pantry permissions or backend policies.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => decide(true)}
                  disabled={busy}
                  className="flex-1 rounded-xl"
                  variant="hero"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
                <Button
                  onClick={() => decide(false)}
                  disabled={busy}
                  variant="outline"
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
