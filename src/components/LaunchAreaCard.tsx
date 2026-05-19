import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, MapPin } from "lucide-react";
import { WaitlistDialog } from "./WaitlistDialog";
import { LAUNCH_CITIES, type LaunchCity } from "@/lib/launchArea";

type Props = { matchedCity: LaunchCity | null; zipCode?: string | null };

export function LaunchAreaCard({ matchedCity, zipCode }: Props) {
  if (matchedCity) {
    return (
      <Card className="p-4 rounded-2xl bg-secondary/40 border-secondary/60 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">You're in our {matchedCity.name} launch zone</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every deal below is hand-curated from {matchedCity.name} specialty grocers — refreshed weekly.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  const cityList = LAUNCH_CITIES.map((c) => c.name).join(" · ");
  return (
    <Card className="p-5 rounded-2xl bg-accent/10 border-accent/30 mb-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <Sprout className="h-4 w-4 text-accent-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Deals are launching in select Illinois cities first</p>
          <p className="text-xs text-muted-foreground mt-1">
            Currently serving {cityList}. Your swap engine, recipes, and pantry all keep working everywhere.
          </p>
          <WaitlistDialog
            source="deals_page"
            defaultZip={zipCode}
            trigger={
              <Button size="sm" className="rounded-xl mt-3 h-8 text-xs">
                Tell us where you are
              </Button>
            }
          />
        </div>
      </div>
    </Card>
  );
}
