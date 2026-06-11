import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const RecipeUrlImport = ({ onImported }: { onImported?: () => void }) => {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState<any | null>(null);

  const importIt = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setRecipe(null);
    const { data, error } = await supabase.functions.invoke("recipe-import-url", { body: { url: url.trim() } });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Import failed");
      return;
    }
    setRecipe(data);
    toast.success(`Imported via ${data.source === "json-ld" ? "structured data" : "AI extraction"}`);
  };

  const save = async () => {
    if (!recipe || !user) return;
    const { error } = await supabase.from("saved_recipes").insert({
      user_id: user.id,
      recipe,
      source: "url_import",
      source_url: recipe.source_url ?? url,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved to your library");
    setRecipe(null);
    setUrl("");
    onImported?.();
  };

  return (
    <Card className="p-5 rounded-2xl border-border/50">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent mb-3">
        <Link2 className="h-3.5 w-3.5" /> Import recipe from URL
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && importIt()}
          placeholder="https://example.com/some-recipe"
          className="rounded-xl"
        />
        <Button onClick={importIt} disabled={busy || !url.trim()} variant="hero" className="rounded-xl shrink-0">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
          Import
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Works best on recipe sites with structured data. Falls back to AI parsing for the rest.
      </p>

      {recipe && (
        <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border/40">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-accent">{recipe.cuisine}</div>
              <h3 className="font-semibold text-primary">{recipe.title}</h3>
              <div className="text-xs text-muted-foreground mt-1">
                {recipe.time_minutes}m · {recipe.servings} servings · {recipe.ingredients?.length ?? 0} ingredients · {recipe.steps_count ?? 0} steps
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={save} className="rounded-xl shrink-0">
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
          {recipe.ingredients?.length > 0 && (
            <details className="text-xs text-muted-foreground mt-2">
              <summary className="cursor-pointer hover:text-primary">Preview ingredients</summary>
              <ul className="mt-2 space-y-0.5">
                {recipe.ingredients.slice(0, 12).map((i: any, idx: number) => (
                  <li key={idx}>• {i.quantity} {i.item}</li>
                ))}
              </ul>
            </details>
          )}
          {recipe.source_url && (
            <p className="text-xs text-muted-foreground mt-3">
              Cooking instructions stay at the source —{" "}
              <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                view full recipe
              </a>.
            </p>
          )}
        </div>
      )}

    </Card>
  );
};
