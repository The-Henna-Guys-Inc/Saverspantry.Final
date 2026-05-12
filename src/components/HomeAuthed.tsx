import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CalendarDays,
  ChefHat,
  Search,
  Sparkles,
  Tag,
  PackageOpen,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { NutritionLookup } from "@/components/NutritionLookup";

type Props = { user: User };

const greet = () => {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

// Monday of current week (ISO week start)
const currentWeekStart = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export const HomeAuthed = ({ user }: Props) => {
  const [name, setName] = useState<string>("");
  const [monthSavings, setMonthSavings] = useState<number>(0);
  const [hasPlanThisWeek, setHasPlanThisWeek] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState(false);

  // Contextual signals
  const [expiringSoon, setExpiringSoon] = useState<{ item: string; expires_on: string }[]>([]);
  const [lowStock, setLowStock] = useState<{ item: string }[]>([]);
  const [watchlistCount, setWatchlistCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { data: sav }, { data: plan }, { data: pantry }, { data: watch }] =
        await Promise.all([
          supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("savings_events")
            .select("amount_usd")
            .eq("user_id", user.id)
            .gte("occurred_at", startOfMonth()),
          supabase
            .from("meal_plans")
            .select("week_start_date")
            .eq("user_id", user.id)
            .eq("week_start_date", currentWeekStart())
            .maybeSingle(),
          supabase
            .from("pantry_items")
            .select("item, expires_on, quantity, low_stock_threshold")
            .eq("user_id", user.id),
          supabase.from("watchlist_items").select("id").eq("user_id", user.id),
        ]);

      if (cancelled) return;

      setName((prof?.display_name as string) || (user.email?.split("@")[0] ?? ""));

      const total = (sav ?? []).reduce((s, r: any) => s + Number(r.amount_usd || 0), 0);
      setMonthSavings(total);

      setHasPlanThisWeek(!!plan);

      const today = new Date();
      const in5 = new Date();
      in5.setDate(today.getDate() + 5);

      const expiring = (pantry ?? [])
        .filter((p: any) => p.expires_on && new Date(p.expires_on) <= in5)
        .sort((a: any, b: any) => (a.expires_on > b.expires_on ? 1 : -1))
        .slice(0, 3)
        .map((p: any) => ({ item: p.item, expires_on: p.expires_on }));
      setExpiringSoon(expiring);

      const low = (pantry ?? [])
        .filter(
          (p: any) =>
            p.low_stock_threshold != null && Number(p.quantity) <= Number(p.low_stock_threshold),
        )
        .slice(0, 3)
        .map((p: any) => ({ item: p.item }));
      setLowStock(low);

      setWatchlistCount(watch?.length ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const cta = useMemo(() => {
    if (!hasPlanThisWeek) {
      return { label: "Plan this week's meals", to: "/planner", icon: CalendarDays };
    }
    return { label: "See this week's recipes", to: "/planner?tab=recipes", icon: ChefHat };
  }, [hasPlanThisWeek]);

  const cards: React.ReactNode[] = [];
  if (expiringSoon.length > 0) {
    cards.push(
      <Link key="exp" to="/pantry?tab=expiry" className="block">
        <Card className="p-5 rounded-2xl border-border/60 hover:shadow-soft transition-smooth">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {expiringSoon.length} item{expiringSoon.length === 1 ? "" : "s"} expiring soon
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {expiringSoon.map((e) => e.item).join(", ")}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
          </div>
        </Card>
      </Link>,
    );
  }
  if (lowStock.length > 0 && cards.length < 2) {
    cards.push(
      <Link key="low" to="/pantry" className="block">
        <Card className="p-5 rounded-2xl border-border/60 hover:shadow-soft transition-smooth">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <PackageOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Running low</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {lowStock.map((l) => l.item).join(", ")}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
          </div>
        </Card>
      </Link>,
    );
  }
  if (cards.length < 2) {
    cards.push(
      <Link key="watch" to={watchlistCount > 0 ? "/deals?tab=sales" : "/deals?tab=watchlist"} className="block">
        <Card className="p-5 rounded-2xl border-border/60 hover:shadow-soft transition-smooth">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {watchlistCount > 0 ? "Check deals on your staples" : "Start a price watchlist"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {watchlistCount > 0
                  ? `Watching ${watchlistCount} item${watchlistCount === 1 ? "" : "s"}`
                  : "Get a quiet ping when staples drop in price."}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
          </div>
        </Card>
      </Link>,
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Nutrition search bar */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2 px-4 h-11 rounded-2xl bg-card border border-border text-sm text-muted-foreground hover:bg-secondary transition-smooth"
        >
          <Search className="h-4 w-4" />
          <span>Look up nutrition for any food…</span>
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 animate-fade-up">
          <NutritionLookup />
        </div>
      )}

      {/* Greeting + savings */}
      <section className="rounded-3xl bg-gradient-warm p-6 sm:p-8 border border-border/40">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-semibold">
          <Sparkles className="h-3.5 w-3.5" /> This month
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-primary">
          {greet()}{name ? `, ${name}` : ""}.
        </h1>
        <div className="mt-4">
          <div className="text-5xl sm:text-6xl font-bold text-primary tabular-nums">
            {fmtUsd(monthSavings)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {monthSavings > 0
              ? "saved so far this month"
              : "in savings tracked this month — log your first swap to start counting."}
          </div>
        </div>
        <Button asChild variant="hero" size="lg" className="rounded-2xl mt-5">
          <Link to={cta.to}>
            <cta.icon className="h-4 w-4" />
            {cta.label}
          </Link>
        </Button>
      </section>

      {/* Contextual cards */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">
          For you
        </h2>
        {cards.slice(0, 2)}
      </section>
    </div>
  );
};
