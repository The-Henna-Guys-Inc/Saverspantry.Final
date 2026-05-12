import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpiryDateScanner } from "@/components/ExpiryDateScanner";
import {
  Plus, Minus, MapPin, CalendarDays, Check, ScanLine, Loader2, ArrowRight, ArrowLeft,
  Sparkles, PackageCheck, PackageMinus, CalendarOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ScanResult = {
  code: string;
  productName?: string;
  brand?: string;
  quantity?: string;
  categories?: string;
  imageUrl?: string;
};

export type WizardMode = "add" | "remove";

type Props = {
  open: boolean;
  mode: WizardMode;
  scan: ScanResult | null;
  locations: string[];
  units: string[];
  defaultLocation?: string;
  defaultUnit?: string;
  /** For "remove", preselect from existing pantry stock if available */
  matchedQuantity?: number;
  matchedExpires?: string | null;
  matchedUnit?: string;
  submitting?: boolean;
  onCancel: () => void;
  onComplete: (data: {
    quantity: number;
    unit: string;
    location: string;
    expires: string | null;
  }) => Promise<void> | void;
};

type Step = 1 | 2 | 3 | 4;

const STEP_TITLES: Record<Step, string> = {
  1: "How much?",
  2: "Where is it?",
  3: "When does it expire?",
  4: "All set!",
};

export const ScanPantryWizard = ({
  open, mode, scan, locations, units, defaultLocation = "pantry", defaultUnit = "unit",
  matchedQuantity, matchedExpires, matchedUnit, submitting, onCancel, onComplete,
}: Props) => {
  const [step, setStep] = useState<Step>(1);
  const [qty, setQty] = useState<string>("1");
  const [unit, setUnit] = useState<string>(defaultUnit);
  const [location, setLocation] = useState<string>(defaultLocation);
  const [expires, setExpires] = useState<string>("");
  const [noExpiry, setNoExpiry] = useState<boolean>(false);

  // reset whenever wizard opens with a new scan
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setQty("1");
    setUnit(matchedUnit ?? defaultUnit);
    setLocation(defaultLocation);
    setExpires(matchedExpires ?? "");
    setNoExpiry(mode === "remove" && !matchedExpires);
  }, [open, scan?.code, mode, matchedUnit, matchedExpires, defaultUnit, defaultLocation]);

  const productLabel = useMemo(() => {
    if (!scan) return "";
    if (scan.productName) return scan.brand ? `${scan.brand} ${scan.productName}` : scan.productName;
    return `Item ${scan.code}`;
  }, [scan]);

  const numericQty = Math.max(0, Number(qty) || 0);
  const maxQty = mode === "remove" && typeof matchedQuantity === "number" ? matchedQuantity : undefined;
  const overMax = maxQty !== undefined && numericQty > maxQty;

  const goNext = () => setStep((s) => (Math.min(4, (s + 1) as Step)) as Step);
  const goBack = () => setStep((s) => (Math.max(1, (s - 1) as Step)) as Step);

  const finish = async () => {
    setStep(4);
    await onComplete({
      quantity: numericQty,
      unit,
      location,
      expires: noExpiry ? null : (expires || null),
    });
  };

  const stepIcon = (s: Step) => {
    if (s === 1) return mode === "add" ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />;
    if (s === 2) return <MapPin className="h-3.5 w-3.5" />;
    if (s === 3) return <CalendarDays className="h-3.5 w-3.5" />;
    return <Check className="h-3.5 w-3.5" />;
  };

  const isAdd = mode === "add";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md w-[96vw] sm:w-full p-0 rounded-2xl overflow-hidden">
        {/* Header card with product preview */}
        <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-transparent p-4 pb-3 border-b border-border/40">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-accent">
              {isAdd ? <PackageCheck className="h-3.5 w-3.5" /> : <PackageMinus className="h-3.5 w-3.5" />}
              {isAdd ? "Adding to pantry" : "Using one up"}
            </div>
            <DialogTitle className="text-lg">{STEP_TITLES[step]}</DialogTitle>
            <DialogDescription className="sr-only">
              {isAdd ? "Add a scanned item to your pantry" : "Remove a scanned item from your pantry"}
            </DialogDescription>
          </DialogHeader>

          {scan && (
            <div className="mt-3 flex items-center gap-3 p-2.5 rounded-xl bg-background/70 backdrop-blur border border-border/40">
              {scan.imageUrl ? (
                <img src={scan.imageUrl} alt={productLabel} className="h-12 w-12 rounded-lg object-cover border border-border" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                  <ScanLine className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-primary text-sm truncate">{productLabel}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {scan.brand ? `${scan.brand} · ` : ""}{scan.code}
                </div>
              </div>
            </div>
          )}

          {/* Stepper */}
          <div className="mt-4 flex items-center gap-1.5">
            {([1, 2, 3] as Step[]).map((s, i) => {
              const active = step === s;
              const done = step > s || step === 4;
              return (
                <div key={s} className="flex items-center gap-1.5 flex-1">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all",
                    done ? "bg-primary text-primary-foreground border-primary" :
                    active ? "bg-accent text-accent-foreground border-accent scale-110 shadow-glow" :
                    "bg-background text-muted-foreground border-border"
                  )}>
                    {done && step !== s ? <Check className="h-3.5 w-3.5" /> : stepIcon(s)}
                  </div>
                  {i < 2 && (
                    <div className={cn(
                      "flex-1 h-0.5 rounded-full transition-colors",
                      step > s ? "bg-primary" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step body */}
        <div className="p-5 space-y-4 min-h-[220px]">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="text-center space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {isAdd ? "Quantity to add" : "Quantity to use"}
                </div>
                {maxQty !== undefined && (
                  <div className="text-[11px] text-muted-foreground">
                    You currently have <span className="font-semibold text-foreground">{maxQty} {matchedUnit ?? unit}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button" variant="outline" size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => setQty(String(Math.max(0, +(numericQty - 1).toFixed(2))))}
                  disabled={numericQty <= 0}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Input
                  inputMode="decimal"
                  type="number"
                  min={0}
                  step="0.1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-16 w-24 text-center text-2xl font-bold rounded-2xl"
                />
                <Button
                  type="button" variant="outline" size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => setQty(String(+(numericQty + 1).toFixed(2)))}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-9 w-28 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {[1, 2, 3, 5, 10].map((n) => (
                  <Button
                    key={n} type="button" variant="ghost" size="sm"
                    className="h-7 rounded-full text-xs px-3"
                    onClick={() => setQty(String(n))}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              {overMax && (
                <p className="text-center text-xs text-destructive">
                  You only have {maxQty} {matchedUnit ?? unit} on hand.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="text-center text-xs text-muted-foreground uppercase tracking-wider">
                {isAdd ? "Where will it live?" : "Where is it stored?"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {locations.map((l) => {
                  const selected = location === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocation(l)}
                      className={cn(
                        "rounded-xl border-2 px-3 py-3 text-sm font-medium capitalize transition-all min-h-[56px] flex items-center justify-center gap-2",
                        selected
                          ? "border-primary bg-primary/10 text-primary shadow-glow scale-[1.02]"
                          : "border-border bg-card text-foreground/80 hover:border-primary/40"
                      )}
                    >
                      <MapPin className="h-4 w-4 opacity-70" />
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="text-center text-xs text-muted-foreground uppercase tracking-wider">
                {isAdd ? "Expiry date" : "Expiry on the lot you're using"}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={noExpiry ? "" : expires}
                    onChange={(e) => { setExpires(e.target.value); if (e.target.value) setNoExpiry(false); }}
                    disabled={noExpiry}
                    className="h-12 rounded-xl flex-1 text-base"
                  />
                  <ExpiryDateScanner onDate={(d) => { setExpires(d); setNoExpiry(false); }} />
                </div>
                <button
                  type="button"
                  onClick={() => { setNoExpiry((v) => !v); if (!noExpiry) setExpires(""); }}
                  className={cn(
                    "w-full rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[44px]",
                    noExpiry
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <CalendarOff className="h-4 w-4" /> No expiry / not sure
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {[
                  { label: "+1 wk", days: 7 },
                  { label: "+1 mo", days: 30 },
                  { label: "+3 mo", days: 90 },
                  { label: "+6 mo", days: 180 },
                  { label: "+1 yr", days: 365 },
                ].map((opt) => (
                  <Button
                    key={opt.label} type="button" variant="ghost" size="sm"
                    className="h-7 rounded-full text-xs px-3"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + opt.days);
                      setExpires(d.toISOString().slice(0, 10));
                      setNoExpiry(false);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-6 space-y-3 animate-in fade-in zoom-in-95 duration-300">
              <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
                {submitting ? (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <Sparkles className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="text-center">
                <div className="font-semibold text-primary">
                  {submitting ? "Saving…" : isAdd ? "Added to your pantry" : "Removed from your pantry"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {numericQty} {unit} · {location}
                  {!noExpiry && expires ? ` · exp ${expires}` : ""}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 pt-0 gap-2 sm:gap-2 flex-row">
          {step > 1 && step < 4 && (
            <Button variant="outline" className="rounded-xl flex-1 h-11" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
          )}
          {step === 1 && (
            <Button variant="ghost" className="rounded-xl flex-1 h-11" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {step < 3 && (
            <Button
              variant="hero" className="rounded-xl flex-1 h-11"
              onClick={goNext}
              disabled={(step === 1 && (numericQty <= 0 || overMax)) || (step === 2 && !location)}
            >
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="hero" className="rounded-xl flex-1 h-11"
              onClick={finish}
              disabled={submitting}
            >
              {isAdd ? <><Check className="h-4 w-4 mr-1.5" /> Add to pantry</>
                     : <><Check className="h-4 w-4 mr-1.5" /> Remove now</>}
            </Button>
          )}
          {step === 4 && (
            <Button
              variant="hero" className="rounded-xl flex-1 h-11"
              onClick={onCancel}
              disabled={submitting}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
