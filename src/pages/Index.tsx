import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import heroImg from "@/assets/hero-foods.jpg";
import { Header } from "@/components/Header";
import { HomeAuthed } from "@/components/HomeAuthed";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftRight, Sparkles, ChefHat, Beef, Lock, Apple, Repeat } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type FeatureKey = "nutrition" | "swaps" | "recipes";

const FEATURES: Record<FeatureKey, {
  label: string;
  icon: typeof Apple;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  cta: string;
  href: string;
}> = {
  nutrition: {
    label: "Nutrition",
    icon: Apple,
    eyebrow: "Nutrition Lookup",
    title: "Ask anything. Get instant nutrition.",
    body: "Type any food and portion in plain English. Get USDA-grade macros, key micronutrients, and a money-saving tip in seconds — with AI as a smart fallback when the database doesn't have it.",
    bullets: [
      "Natural language input — \"1 cup cooked quinoa\"",
      "Calories, protein, carbs, fiber, fat + standout micros",
      "Source-tagged so you know where the numbers came from",
    ],
    cta: "Open Nutrition Lookup",
    href: "/cook?tab=nutrition",
  },
  swaps: {
    label: "Swaps",
    icon: Repeat,
    eyebrow: "Equivalency Engine",
    title: "Same nutrition. Less money.",
    body: "Enter a food. Get cheaper swaps that match the protein and calories — so you spend less without giving up what your body needs.",
    bullets: [
      "Three nutritionally-equivalent alternatives per swap",
      "Protein and calorie matched, cost-aware",
      "Great for stretching grocery budgets and pantry staples",
    ],
    cta: "Open Equivalency Engine",
    href: "/cook?tab=swaps",
  },
  recipes: {
    label: "Recipes",
    icon: ChefHat,
    eyebrow: "Recipe Generator",
    title: "Cook with what you have.",
    body: "List your ingredients, pick a cuisine, and get a recipe with steps, nutrition, and an estimated cost — built around what's already in your kitchen.",
    bullets: [
      "Uses items you already own to cut waste",
      "Cuisine-aware: Indian, Mexican, Italian, and more",
      "Steps + per-serving nutrition + cost estimate",
    ],
    cta: "Open Recipe Generator",
    href: "/cook?tab=recipes",
  },
};

const Index = () => {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<FeatureKey>("nutrition");
  const active = FEATURES[tab];
  const ActiveIcon = active.icon;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <HomeAuthed user={user} />
      </main>
    );
  }

  return <Navigate to="/welcome" replace />;

  // Legacy marketing page (kept for reference, unreachable)
  // eslint-disable-next-line no-unreachable
  return (
    <main className="min-h-screen bg-background">
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-warm" />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary-glow/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-accent/15 blur-3xl" />

        <div className="relative container max-w-6xl mx-auto px-6 pt-10 pb-6 sm:pt-20 sm:pb-16">
          <div className="text-center max-w-3xl mx-auto animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border shadow-soft mb-6">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium tracking-wide text-foreground/80">
                Intelligent nutrition swaps
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold text-primary leading-[1.05] tracking-tight">
              Eat well.<br />
              <span className="bg-gradient-leaf bg-clip-text text-transparent">Spend less.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Swap any food for a nutritionally-equivalent alternative — usually cheaper.
              Look up macros, find swaps, and generate recipes with AI.
            </p>

            <img
              src={heroImg}
              alt="Fresh whole foods including lentils, paneer, spinach, eggs and tomatoes arranged on linen"
              width={1536}
              height={1024}
              className="mt-6 sm:mt-10 mx-auto rounded-3xl shadow-glow max-w-4xl w-full object-cover aspect-[3/2]"
            />
          </div>
        </div>
      </section>

      {/* Feature tabs (informational only) */}
      <section id="features" className="container max-w-5xl mx-auto px-6 py-10 sm:py-16">
        <div className="text-center mb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">What's inside</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-primary">
            Three tools. One smarter kitchen.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Tap a tab to see what each tool does. Open any tool to start using it.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as FeatureKey)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 mb-4 gap-1.5 sm:gap-2 h-auto">
            {(Object.keys(FEATURES) as FeatureKey[]).map((k) => {
              const f = FEATURES[k];
              const Icon = f.icon;
              return (
                <TabsTrigger
                  key={k}
                  value={k}
                  className="w-full min-w-0 rounded-xl gap-1 sm:gap-2 px-1.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border bg-card text-foreground/70 shadow-soft hover:bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-glow transition-smooth"
                >
                  <Icon className="h-4 w-4" />{f.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(Object.keys(FEATURES) as FeatureKey[]).map((k) => {
            const f = FEATURES[k];
            const Icon = f.icon;
            return (
              <TabsContent key={k} value={k} className="mt-0">
                <Card className="p-6 sm:p-10 rounded-3xl shadow-soft border-border/60 bg-card animate-fade-up">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-leaf flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">{f.eyebrow}</span>
                      <h3 className="mt-1 text-2xl sm:text-3xl font-bold text-primary leading-tight">{f.title}</h3>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-5">{f.body}</p>
                  <ul className="space-y-2 mb-6">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="hero" size="lg" className="rounded-2xl">
                      <Link to={f.href}>{f.cta}</Link>
                    </Button>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" /> Sign in required
                    </span>
                  </div>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </section>

      {/* CTA */}
      <section className="container max-w-4xl mx-auto px-6 py-10 sm:py-16">
        <Link to="/planner" className="block">
          <Card className="p-10 sm:p-14 rounded-[2rem] bg-gradient-leaf border-0 shadow-glow text-center hover:shadow-soft transition-smooth">
            <Beef className="h-10 w-10 text-primary-foreground mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground">
              Build your weekly plan — for less.
            </h2>
            <p className="mt-3 text-primary-foreground/80 max-w-lg mx-auto">
              Generate a 7-day meal plan and a smart grocery list in seconds.
            </p>
          </Card>
        </Link>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        ThriftPantry — built with care.
      </footer>
    </main>
  );
};

export default Index;
