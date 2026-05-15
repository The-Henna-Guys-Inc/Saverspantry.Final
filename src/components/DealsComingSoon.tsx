import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag, Sprout, Lock } from "lucide-react";
import { WaitlistDialog } from "./WaitlistDialog";
import { DEALS_LAUNCH_DATE } from "@/lib/featureFlags";

function diffParts(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, mins };
}

export function DealsComingSoon() {
  const [parts, setParts] = useState(() => diffParts(DEALS_LAUNCH_DATE));
  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(DEALS_LAUNCH_DATE)), 60_000);
    return () => clearInterval(id);
  }, []);

  const Cell = ({ n, label }: { n: number; label: string }) => (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-card border border-border px-4 py-3 min-w-[72px] shadow-soft">
      <span className="text-2xl font-bold text-primary tabular-nums">{n}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</span>
    </div>
  );

  return (
    <Card className="p-6 sm:p-10 rounded-2xl bg-secondary/30 border-secondary/50 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground">
        Deals are launching soon
      </h1>
      <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
        We're hand-curating weekly deals from local specialty grocers. The Deals
        tab unlocks the moment our first batch is ready.
      </p>

      <div className="mt-6 flex items-center justify-center gap-2 sm:gap-3">
        <Cell n={parts.days} label="Days" />
        <Cell n={parts.hours} label="Hours" />
        <Cell n={parts.mins} label="Mins" />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
        <WaitlistDialog
          source="deals_page"
          trigger={
            <Button size="lg" className="rounded-xl">
              <Sprout className="h-4 w-4" /> Notify me at launch
            </Button>
          }
        />
      </div>

      <p className="mt-6 text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Tag className="h-3 w-3" />
        Meanwhile, your swap engine, recipes, pantry, and meal planner all keep working.
      </p>
    </Card>
  );
}
