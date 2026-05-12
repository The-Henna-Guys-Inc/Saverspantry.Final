import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

// Baseline: starting savings at a fixed anchor date, growing $102.50/hour.
const ANCHOR_ISO = "2026-05-01T00:00:00Z";
const ANCHOR_VALUE = 12450; // starting "saved for our users" amount in USD
const PER_HOUR = 102.5;

const compute = () => {
  const elapsedHrs = (Date.now() - new Date(ANCHOR_ISO).getTime()) / 3_600_000;
  return ANCHOR_VALUE + elapsedHrs * PER_HOUR;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const SavingsCounter = () => {
  const [val, setVal] = useState(compute);

  useEffect(() => {
    // Tick every second; per-second increment = $102.5 / 3600 ≈ $0.0285
    const id = setInterval(() => setVal(compute()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/15"
      title="Estimated savings unlocked for Saver's Pantry users"
    >
      <TrendingUp className="h-3.5 w-3.5 text-primary" />
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Saved for users</span>
        <span className="text-xs font-semibold text-primary tabular-nums">{fmt(val)}</span>
      </div>
    </div>
  );
};
