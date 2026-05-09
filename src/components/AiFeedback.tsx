import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThumbsUp, ThumbsDown, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Feature =
  | "recipe"
  | "swap"
  | "meal_plan"
  | "grocery_list"
  | "bulk_buy"
  | "pantry"
  | "deals";

interface Props {
  feature: Feature;
  /** Small JSON snapshot to help us debug bad outputs (avoid PII / huge payloads). */
  context?: Record<string, unknown>;
  /** Optional reference to a saved row id (e.g. saved_recipes.id). */
  sourceId?: string | null;
  className?: string;
  label?: string;
}

const LABELS: Record<Feature, string> = {
  recipe: "this recipe",
  swap: "these swaps",
  meal_plan: "this meal plan",
  grocery_list: "this grocery list",
  bulk_buy: "these recommendations",
  pantry: "this pantry suggestion",
  deals: "these deals",
};

export const AiFeedback = ({ feature, context, sourceId, className, label }: Props) => {
  const [submitted, setSubmitted] = useState<null | "up" | "down">(null);
  const [pendingDown, setPendingDown] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (rating: "up" | "down", note?: string) => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to send feedback");
      const { error } = await supabase.from("ai_feedback").insert({
        user_id: user.id,
        feature,
        rating,
        comment: note?.trim() || null,
        source_id: sourceId ?? null,
        context: (context ?? {}) as any,
      });
      if (error) throw error;
      setSubmitted(rating);
      setPendingDown(false);
      toast.success("Thanks — feedback recorded");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save feedback");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        <span>Thanks for the feedback</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
      <span className="hidden sm:inline">How was {label ?? LABELS[feature]}?</span>
      <button
        type="button"
        onClick={() => send("up")}
        disabled={busy}
        title="Helpful"
        className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-primary/15 text-foreground transition-smooth disabled:opacity-50"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <Popover open={pendingDown} onOpenChange={setPendingDown}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={busy}
            title="Not great"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-destructive/15 text-foreground transition-smooth disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 rounded-2xl">
          <div className="text-sm font-semibold text-foreground mb-1">What went wrong?</div>
          <p className="text-xs text-muted-foreground mb-2">Optional — helps us improve future results.</p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. ingredients didn't match the cuisine"
            className="min-h-[72px] rounded-xl text-sm"
            maxLength={500}
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={() => setPendingDown(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" variant="default" onClick={() => send("down", comment)} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
