import heroImg from "@/assets/hero-foods.jpg";
import { NutritionLookup } from "@/components/NutritionLookup";
import { EquivalencyEngine } from "@/components/EquivalencyEngine";
import { RecipeGenerator } from "@/components/RecipeGenerator";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { ArrowLeftRight, Sparkles, ChefHat, Beef } from "lucide-react";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-warm" />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary-glow/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-accent/15 blur-3xl" />

        <div className="relative container max-w-6xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="text-center max-w-3xl mx-auto animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border shadow-soft mb-6">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium tracking-wide text-foreground/80">
                AI-powered nutrition swaps
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
              className="mt-12 mx-auto rounded-3xl shadow-glow max-w-4xl w-full object-cover aspect-[3/2]"
            />
          </div>
        </div>
      </section>

      {/* Nutrition lookup */}
      <section id="lookup" className="container max-w-6xl mx-auto px-6 py-20 sm:py-24">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Nutrition Lookup</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-primary">
            Ask anything. Get instant nutrition.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Natural language in. Macros, micros, and a money-saving tip out.
          </p>
        </div>
        <NutritionLookup />
      </section>

      {/* Equivalency engine */}
      <section id="swap" className="bg-gradient-warm py-20 sm:py-24">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Equivalency Engine</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-primary">
              Same nutrition. Less money.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Enter a food. Get three swaps that match the protein and calories — usually for less.
            </p>
          </div>
          <EquivalencyEngine />
        </div>
      </section>

      {/* Recipe generator */}
      <section id="recipe" className="container max-w-6xl mx-auto px-6 py-20 sm:py-24">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Recipe Generator</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-primary">
            Cook with what you have.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            List your ingredients, pick a cuisine, and get a recipe with steps, nutrition, and cost.
          </p>
        </div>
        <RecipeGenerator />
      </section>

      {/* Pillars */}
      <section id="services" className="bg-gradient-warm py-20 sm:py-24">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">How it works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-primary">Three tools. One smarter kitchen.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Sparkles, title: "AI Nutrition Lookup", body: "Type any food and portion. Get accurate macros and key micronutrients in seconds.", href: "#lookup" },
              { icon: ArrowLeftRight, title: "Equivalency Engine", body: "Swap 200g chicken for 1 cup lentils + 100g paneer — same protein, less money.", href: "#swap" },
              { icon: ChefHat, title: "Recipe Generator", body: "List what you have, pick a cuisine, and get a recipe with steps, nutrition, and cost.", href: "#recipe" },
            ].map((p) => (
              <a key={p.title} href={p.href}
                className="group p-6 rounded-3xl border border-border/60 shadow-soft hover:shadow-glow transition-smooth bg-card block">
                <div className="w-12 h-12 rounded-2xl bg-gradient-leaf flex items-center justify-center mb-4 group-hover:scale-105 transition-smooth">
                  <p.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-primary">{p.title}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">Live</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container max-w-4xl mx-auto px-6 py-20 sm:py-24">
        <a href="/planner" className="block">
          <Card className="p-10 sm:p-14 rounded-[2rem] bg-gradient-leaf border-0 shadow-glow text-center hover:shadow-soft transition-smooth">
            <Beef className="h-10 w-10 text-primary-foreground mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground">
              Build your weekly plan — for less.
            </h2>
            <p className="mt-3 text-primary-foreground/80 max-w-lg mx-auto">
              Generate a 7-day meal plan and a smart grocery list in seconds.
            </p>
          </Card>
        </a>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        NutriSwap — built with care.
      </footer>
    </main>
  );
};

export default Index;
