import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChefHat, Repeat, Utensils, Apple } from "lucide-react";
import { RecipeGenerator } from "@/components/RecipeGenerator";
import { EquivalencyEngine } from "@/components/EquivalencyEngine";
import { NutritionLookup } from "@/components/NutritionLookup";

const Cook = () => {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = rawTab === "swaps" || rawTab === "nutrition" ? rawTab : "recipes";
  const setTab = (v: string) => setSearchParams(v === "recipes" ? {} : { tab: v });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <Utensils className="h-3.5 w-3.5" /> Cook
        </div>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 mb-3 gap-1.5 sm:gap-2 h-auto">
            <TabsTrigger
              value="recipes"
              className="rounded-xl gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border bg-card text-foreground/70 shadow-soft hover:bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-glow transition-smooth"
            >
              <ChefHat className="h-4 w-4" />Recipes
            </TabsTrigger>
            <TabsTrigger
              value="swaps"
              className="rounded-xl gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border bg-card text-foreground/70 shadow-soft hover:bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-glow transition-smooth"
            >
              <Repeat className="h-4 w-4" />Swaps
            </TabsTrigger>
            <TabsTrigger
              value="nutrition"
              className="rounded-xl gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border bg-card text-foreground/70 shadow-soft hover:bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-glow transition-smooth"
            >
              <Apple className="h-4 w-4" />Nutrition
            </TabsTrigger>
          </TabsList>
          <p className="text-muted-foreground mb-6">
            {tab === "recipes" && "Generate recipes from what you already have in your pantry."}
            {tab === "swaps" && "Swap pricey ingredients for cheaper, equivalent ones."}
            {tab === "nutrition" && "Look up USDA-grade nutrition for any food or portion."}
          </p>
          <TabsContent value="recipes" className="mt-0"><RecipeGenerator /></TabsContent>
          <TabsContent value="swaps" className="mt-0"><EquivalencyEngine /></TabsContent>
          <TabsContent value="nutrition" className="mt-0"><NutritionLookup /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Cook;
