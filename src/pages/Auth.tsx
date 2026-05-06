import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sprout } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
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

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-gradient-warm flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-leaf flex items-center justify-center shadow-soft">
            <Sprout className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-primary">NutriSwap</span>
        </Link>

        <Card className="p-7 rounded-3xl shadow-glow border-border/50">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary rounded-2xl">
              <TabsTrigger value="login" className="rounded-xl">Log in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl">Sign up</TabsTrigger>
            </TabsList>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-2xl mb-4"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>

            <TabsContent value="login" className="space-y-3 m-0">
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" />
              <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl" />
              <Button onClick={handleLogin} disabled={loading} variant="hero" className="w-full h-12 rounded-2xl">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 m-0">
              <Input placeholder="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-2xl" />
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" />
              <Input placeholder="Password (min 8 chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl" />
              <Button onClick={handleSignup} disabled={loading} variant="hero" className="w-full h-12 rounded-2xl">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                We'll email you a confirmation link.
              </p>
            </TabsContent>
          </Tabs>
        </Card>

        <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground mt-6 transition-smooth">
          ← Back to home
        </Link>
      </div>
    </main>
  );
};

export default Auth;
