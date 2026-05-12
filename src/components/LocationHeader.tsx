import { useState } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserLocation } from "@/hooks/useUserLocation";
import { toast } from "sonner";

export function LocationHeader() {
  const { location, zipCode, radiusMiles, loading, requestPrecise, setManualZip, setRadius } =
    useUserLocation();
  const [zipDraft, setZipDraft] = useState(zipCode ?? "");
  const [open, setOpen] = useState(false);

  const handleSaveZip = async () => {
    if (!/^\d{5}$/.test(zipDraft.trim())) {
      toast.error("Enter a 5-digit ZIP code");
      return;
    }
    await setManualZip(zipDraft.trim());
    toast.success("Location updated");
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap mb-4 p-3 rounded-2xl bg-secondary/50 border border-border/50">
      <div className="flex items-center gap-2 min-w-0 text-sm">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : location ? (
          <span className="truncate">
            Deals near <span className="font-semibold">{location.label}</span> · within {radiusMiles} mi
          </span>
        ) : (
          <span className="text-muted-foreground">Set a ZIP code to see deals near you</span>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs">
            Change
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 rounded-2xl">
          <div className="space-y-3">
            <Button
              onClick={requestPrecise}
              variant="hero"
              size="sm"
              className="w-full rounded-xl"
            >
              <Navigation className="h-3.5 w-3.5 mr-1.5" />
              Use my precise location
            </Button>
            <div className="text-[11px] text-muted-foreground text-center">or enter ZIP</div>
            <div className="flex gap-2">
              <Input
                value={zipDraft}
                onChange={(e) => setZipDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="ZIP"
                inputMode="numeric"
                className="rounded-xl"
              />
              <Button size="sm" onClick={handleSaveZip} className="rounded-xl">
                Save
              </Button>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Search radius</div>
              <Select
                value={String(radiusMiles)}
                onValueChange={(v) => setRadius(Number(v))}
              >
                <SelectTrigger className="rounded-xl h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 25, 50].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} miles
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
