import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";
import { Loader2, Bookmark, PiggyBank, Smartphone, Mail, ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

const SIGNUP_BENEFITS = [
  { icon: Bookmark, text: "Your swaps and recipes saved automatically" },
  { icon: PiggyBank, text: "Monthly savings tracked in real time" },
  { icon: Smartphone, text: "Access everything across phone and web" },
];

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<"choose" | "signin" | "email-signup" | "email-login">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account.");
  };

  const handleLogin = async () => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate("/");
  };

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    const nextMode = requestedMode === "signup" ? "choose" : "signin";
    setMode((currentMode) => {
      if (currentMode === "email-signup" || currentMode === "email-login") return currentMode;
      return currentMode === nextMode ? currentMode : nextMode;
    });
  }, [searchParams]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      try {
        GoogleAuth.initialize({
          clientId: "", // iOS uses Info.plist GIDClientID; web client id optional here
          scopes: ["profile", "email"],
          grantOfflineAccess: false,
        });
      } catch (e) {
        console.warn("GoogleAuth init failed", e);
      }
    }
  }, []);

  const handleNativeGoogle = async () => {
    const user = await GoogleAuth.signIn();
    const idToken = user.authentication?.idToken;
    if (!idToken) throw new Error("No Google id token");
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) throw error;
  };

  const handleOAuth = async (provider: "google" | "apple" = "google") => {
    const TAG = "[auth-debug]";
    console.log(TAG, "handleOAuth start", {
      provider,
      native: Capacitor.isNativePlatform(),
      origin: window.location.origin,
      href: window.location.href,
    });
    setLoading(true);
    try {
      if (provider === "google" && Capacitor.isNativePlatform()) {
        await handleNativeGoogle();
        console.log(TAG, "native sign-in completed");
        toast.success("Signed in!");
        navigate("/");
        return;
      }
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      console.log(TAG, "lovable.signInWithOAuth result", {
        redirected: result.redirected,
        hasError: !!result.error,
        error: result.error,
      });
      if (result.error) {
        toast.error(`${provider === "apple" ? "Apple" : "Google"} sign-in failed`);
        return;
      }
      if (result.redirected) return;
      navigate("/");
    } catch (e: any) {
      console.error(TAG, "handleOAuth threw", e);
      toast.error(e?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };


  const CREAM = "#FAF5EC";
  const GREEN = "#1F5132";
  const ESPRESSO = "#412402";
  const MUTED = "#5F5E5A";
  const CARD_BORDER = "rgba(31,81,50,0.12)";

  const GoogleBtn = (
    <Button
      type="button"
      variant="outline"
      className="w-full rounded-xl bg-white hover:bg-white/90"
      style={{ height: 48, fontSize: 15, fontWeight: 600, color: GREEN, borderColor: GREEN, borderWidth: 1, paddingTop: 14, paddingBottom: 14 }}
      onClick={() => handleOAuth()}
      disabled={loading}
    >
      <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Continue with Google
    </Button>
  );

  const EmailBtn = (target: "email-signup" | "email-login") => (
    <Button
      type="button"
      variant="outline"
      className="w-full rounded-xl bg-white hover:bg-white/90"
      style={{ height: 48, fontSize: 15, fontWeight: 600, color: GREEN, borderColor: GREEN, borderWidth: 1, paddingTop: 14, paddingBottom: 14 }}
      onClick={() => setMode(target)}
      disabled={loading}
    >
      <Mail className="h-4 w-4 mr-2" />
      Continue with email
    </Button>
  );

  const switchTopLevelMode = (nextMode: "choose" | "signin") => {
    setMode(nextMode);
    setSearchParams(nextMode === "signin" ? {} : { mode: "signup" }, { replace: true });
  };

  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    border: `1px solid ${CARD_BORDER}`,
    boxShadow: "0 4px 20px -8px rgba(31,81,50,0.18)",
  };

  const isSignin = mode === "signin";

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6" style={{ background: CREAM }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <BrandMark to="/welcome" size="lg" showTagline />
        </div>

        <div style={cardStyle}>
          {mode === "choose" && (
            <>
              <h1 className="text-center" style={{ color: GREEN, fontWeight: 700, fontSize: 22 }}>
                Create your free account
              </h1>
              <p className="text-center mt-1" style={{ color: MUTED, fontSize: 14 }}>
                It takes about 10 seconds — your savings sync across devices.
              </p>

              <ul className="mt-5 space-y-3">
                {SIGNUP_BENEFITS.map((b) => {
                  const Icon = b.icon;
                  return (
                    <li key={b.text} className="flex items-start gap-3">
                      <div
                        className="rounded-full flex items-center justify-center shrink-0"
                        style={{ width: 44, height: 44, background: "rgba(182,90,56,0.12)" }}
                      >
                        <Icon className="h-5 w-5" style={{ color: "#B65A38" }} />
                      </div>
                      <span className="pt-2.5" style={{ color: ESPRESSO, fontSize: 14 }}>
                        {b.text}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 space-y-2.5">
                {GoogleBtn}
                {EmailBtn("email-signup")}
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => switchTopLevelMode("signin")}
                  style={{ color: MUTED, minHeight: 44 }}
                  className="hover:opacity-80 transition-smooth"
                >
                  I have an account
                </button>
                <Link to="/demo" style={{ color: MUTED, minHeight: 44 }} className="flex items-center hover:opacity-80 transition-smooth">
                  Maybe later →
                </Link>
              </div>
            </>
          )}

          {mode === "signin" && (
            <>
              <h1 className="text-center" style={{ color: GREEN, fontWeight: 700, fontSize: 22 }}>
                Welcome back
              </h1>
              <p className="text-center mt-1" style={{ color: MUTED, fontSize: 14 }}>
                Sign in to your savings
              </p>

              <div className="mt-6 space-y-2.5">
                {GoogleBtn}
                {EmailBtn("email-login")}
              </div>

              <div className="mt-6 pt-5 text-center" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                <p style={{ color: MUTED, fontSize: 13 }}>New to Saver's Pantry?</p>
                <button
                  type="button"
                  onClick={() => switchTopLevelMode("choose")}
                  className="mt-1 hover:opacity-80 transition-smooth"
                  style={{ color: GREEN, fontSize: 14, fontWeight: 600, minHeight: 44 }}
                >
                  Create a free account →
                </button>
              </div>
            </>
          )}

          {mode === "email-signup" && (
            <>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="flex items-center gap-1 mb-3 hover:opacity-80"
                style={{ color: MUTED, fontSize: 14, minHeight: 44 }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 style={{ color: GREEN, fontWeight: 700, fontSize: 20 }}>Create account with email</h2>
              <div className="space-y-3 mt-4">
                <Input placeholder="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" />
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
                <Input placeholder="Password (min 8 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
                <Button
                  onClick={handleSignup}
                  disabled={loading}
                  className="w-full rounded-xl text-white hover:opacity-90"
                  style={{ height: 48, background: GREEN, fontSize: 15, fontWeight: 600 }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
                <p className="text-center" style={{ color: MUTED, fontSize: 12 }}>
                  We'll email you a confirmation link.
                </p>
              </div>
            </>
          )}

          {mode === "email-login" && (
            <>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="flex items-center gap-1 mb-3 hover:opacity-80"
                style={{ color: MUTED, fontSize: 14, minHeight: 44 }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 style={{ color: GREEN, fontWeight: 700, fontSize: 20 }}>Sign in with email</h2>
              <div className="space-y-3 mt-4">
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
                <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full rounded-xl text-white hover:opacity-90"
                  style={{ height: 48, background: GREEN, fontSize: 15, fontWeight: 600 }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </div>
            </>
          )}
        </div>

        {isSignin && (
          <div className="mt-5 text-center">
            <Link to="/welcome" className="hover:opacity-80 inline-flex items-center" style={{ color: MUTED, fontSize: 13, minHeight: 44 }}>
              ← Back to home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
};

export default Auth;
