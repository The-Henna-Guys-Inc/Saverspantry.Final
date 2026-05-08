import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PantryItem = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  category: string | null;
  expires_on: string;
};

const toKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const PantryExpiryView = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("id, item, quantity, unit, category, expires_on")
        .not("expires_on", "is", null)
        .order("expires_on", { ascending: true });
      if (error) toast.error(error.message);
      else setItems((data ?? []) as PantryItem[]);
      setLoading(false);
    })();
  }, [user]);

  const byDate = useMemo(() => {
    const m = new Map<string, PantryItem[]>();
    for (const it of items) {
      if (!it.expires_on) continue;
      (m.get(it.expires_on) ?? m.set(it.expires_on, []).get(it.expires_on)!).push(it);
    }
    return m;
  }, [items]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in5 = new Date(today); in5.setDate(in5.getDate() + 5);

  const expiringDates = useMemo(() => {
    const arr: Date[] = []; const soon: Date[] = []; const expired: Date[] = [];
    for (const key of byDate.keys()) {
      const [y, m, d] = key.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      arr.push(dt);
      if (dt < today) expired.push(dt);
      else if (dt <= in5) soon.push(dt);
    }
    return { all: arr, soon, expired };
  }, [byDate]);

  const selectedItems = selected ? byDate.get(toKey(selected)) ?? [] : [];

  const upcoming = useMemo(
    () => items.filter((i) => {
      const [y, m, d] = i.expires_on.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt >= today && dt <= in5;
    }),
    [items],
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-start">
      <Card className="p-3 rounded-3xl border-border/50 shadow-soft inline-block w-full lg:w-auto">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          modifiers={{ expiring: expiringDates.soon, expired: expiringDates.expired, any: expiringDates.all }}
          modifiersClassNames={{
            expiring: "bg-accent/30 text-accent-foreground font-semibold",
            expired: "bg-destructive/20 text-destructive font-semibold line-through",
            any: "ring-1 ring-primary/30",
          }}
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center gap-3 px-2 pb-2 pt-1 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/30 ring-1 ring-primary/30" /> has items</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/30" /> ≤5 days</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-destructive/20" /> expired</span>
        </div>
      </Card>

      <div className="space-y-6 min-w-0">
        <Card className="p-6 rounded-3xl border-border/50">
          <div className="text-xs uppercase tracking-wider text-accent mb-3">
            {selected ? selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Select a date"}
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing expires on this day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((it) => (
                <li key={it.id} className="flex items-center justify-between text-sm gap-3">
                  <span className="font-medium text-primary truncate">{it.item}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{it.quantity} {it.unit}{it.category ? ` · ${it.category}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 rounded-3xl border-border/50">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent mb-3">
            <AlertTriangle className="h-3.5 w-3.5" /> Expiring in next 5 days
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">You're in the clear — nothing expiring soon.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((it) => (
                <li key={it.id} className="flex items-center justify-between text-sm gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-primary truncate">{it.item}</div>
                    <div className="text-xs text-muted-foreground">{it.quantity} {it.unit}</div>
                  </div>
                  <Badge variant="secondary" className="rounded-lg shrink-0">{it.expires_on}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
