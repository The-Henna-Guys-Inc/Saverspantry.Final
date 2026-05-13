import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeftRight, PiggyBank, ChefHat, Mail, ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

const BENEFITS = [
  { icon: ArrowLeftRight, text: "Save your swaps and revisit them anytime" },
  { icon: PiggyBank, text: "Track your monthly grocery savings automatically" },
  { icon: ChefHat, text: "Unlock meal planning, pantry tracking & recipe AI" },
];

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "email-signup" | "email-login">("choose");
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

  const handleOAuth = async (provider: "apple" | "google") => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error(`${provider === "apple" ? "Apple" : "Google"} sign-in failed`);
      return;
    }
    if (result.redirected) return;
    navigate("/");
  };

  return (
    <main className="min-h-[100dvh] bg-gradient-warm flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <BrandMark to="/welcome" size="md" showTagline />
        </div>

        <Card className="p-7 rounded-3xl shadow-glow border-border/50">
          {mode === "choose" && (
            <>
              <h1 className="text-2xl font-bold text-primary text-center">Create your free account</h1>
              <p className="text-sm text-muted-foreground text-center mt-1">It takes about 10 seconds.</p>

              <ul className="mt-5 space-y-3">
                {BENEFITS.map((b) => {
                  const Icon = b.icon;
                  return (
                    <li key={b.text} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground/85 pt-1">{b.text}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 space-y-2.5">
                <Button
                  type="button"
                  className="w-full h-12 rounded-2xl bg-foreground text-background hover:bg-foreground/90"
                  onClick={() => handleOAuth("apple")}
                  disabled={loading}
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.94-3.08.5-1.09-.45-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.5C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"/></svg>
                  Continue with Apple
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-2xl"
                  onClick={() => handleOAuth("google")}
                  disabled={loading}
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-2xl"
                  onClick={() => setMode("email-signup")}
                  disabled={loading}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Continue with email
                </Button>
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setMode("email-login")}
                  className="text-muted-foreground hover:text-foreground transition-smooth"
                >
                  I have an account
                </button>
                <Link
                  to="/demo"
                  className="text-muted-foreground hover:text-foreground transition-smooth"
                >
                  Maybe later →
                </Link>
              </div>
            </>
          )}

          {mode === "email-signup" && (
            <>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="text-xl font-bold text-primary">Create account with email</h2>
              <div className="space-y-3 mt-4">
                <Input placeholder="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-2xl" />
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" />
                <Input placeholder="Password (min 8 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl" />
                <Button onClick={handleSignup} disabled={loading} variant="hero" className="w-full h-12 rounded-2xl">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  We'll email you a confirmation link.
                </p>
              </div>
            </>
          )}

          {mode === "email-login" && (
            <>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="text-xl font-bold text-primary">Log in</h2>
              <div className="space-y-3 mt-4">
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" />
                <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl" />
                <Button onClick={handleLogin} disabled={loading} variant="hero" className="w-full h-12 rounded-2xl">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
};

export default Auth;
