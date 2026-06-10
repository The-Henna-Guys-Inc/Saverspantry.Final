import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Play, Trash2, ShieldCheck, RefreshCw, ExternalLink, Edit, Wand2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Source = {
  id: string;
  chain_name: string;
  store_name: string | null;
  region: string | null;
  city: string | null;
  flyer_url: string;
  flyer_landing_url: string | null;
  last_resolved_url: string | null;
  last_resolved_at: string | null;
  requires_week_select: boolean;
  week_selector_css: string | null;
  week_selector_strategy: string | null;
  selector_learned_at: string | null;
  store_zip: string | null;
  store_picker_strategy: "zip" | "storeid" | "none" | null;
  store_picker_input_css: string | null;
  store_picker_submit_css: string | null;
  store_picker_learned_at: string | null;
  render_mode: "html" | "firecrawl";
  default_store_id: string | null;
  cadence: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_batch_id: string | null;
  consecutive_failures: number;
  notes: string | null;
};

const EMPTY: Partial<Source> = {
  chain_name: "", store_name: "", region: "IL", city: "",
  flyer_url: "", flyer_landing_url: "", render_mode: "html",
  default_store_id: null, active: true, notes: "",
  requires_week_select: false, week_selector_css: "",
  store_zip: "", store_picker_strategy: "none",
  store_picker_input_css: "", store_picker_submit_css: "",
};

const AdminFlyerSources = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [runAll, setRunAll] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Source>>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data); setChecking(false);
    })();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("flyer_sources" as any)
      .select("*").order("chain_name");
    if (error) toast.error(error.message);
    setSources((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const save = async () => {
    if (!editing.chain_name || !editing.flyer_url) {
      toast.error("Chain name and URL are required"); return;
    }
    setSaving(true);
    const payload: any = {
      chain_name: editing.chain_name,
      store_name: editing.store_name || null,
      region: editing.region || null,
      city: editing.city || null,
      flyer_url: editing.flyer_url,
      flyer_landing_url: editing.flyer_landing_url || null,
      render_mode: editing.render_mode || "html",
      default_store_id: editing.default_store_id || null,
      active: editing.active ?? true,
      notes: editing.notes || null,
      requires_week_select: editing.requires_week_select ?? false,
      week_selector_css: editing.week_selector_css || null,
      store_zip: editing.store_zip || null,
      store_picker_strategy: editing.store_picker_strategy || "none",
      store_picker_input_css: editing.store_picker_input_css || null,
      store_picker_submit_css: editing.store_picker_submit_css || null,
    };
    const res = editing.id
      ? await supabase.from("flyer_sources" as any).update(payload).eq("id", editing.id)
      : await supabase.from("flyer_sources" as any).insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing.id ? "Updated" : "Added");
    setDialogOpen(false); setEditing(EMPTY); load();
  };

  const toggleActive = async (s: Source) => {
    const { error } = await supabase.from("flyer_sources" as any)
      .update({ active: !s.active }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setSources((prev) => prev.map((x) => x.id === s.id ? { ...x, active: !s.active } : x));
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this source?")) return;
    const { error } = await supabase.from("flyer_sources" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSources((prev) => prev.filter((x) => x.id !== id));
  };

  const runOne = async (id: string) => {
    setRunning(id);
    const { data, error } = await supabase.functions.invoke("discover-flyer-sources", {
      body: { source_ids: [id], triggered_by: "admin" },
    });
    setRunning(null);
    if (error) return toast.error(error.message);
    const r = (data as any)?.results?.[0];
    if (r?.ok) toast.success(`Imported — batch ready for review`);
    else toast.error(`Failed: ${r?.error ?? "unknown"}`);
    load();
  };

  const runAllActive = async () => {
    if (!window.confirm("Run scrape across all active sources now?")) return;
    setRunAll(true);
    const { data, error } = await supabase.functions.invoke("discover-flyer-sources", {
      body: { triggered_by: "admin", force: true },
    });
    setRunAll(false);
    if (error) return toast.error(error.message);
    const r = data as any;
    toast.success(`Ran ${r?.ran ?? 0} of ${r?.scanned ?? 0} sources`);
    load();
  };

  const [resolving, setResolving] = useState<string | null>(null);
  const resolveOne = async (id: string, opts: { relearn?: boolean; relearnPicker?: boolean } = {}) => {
    setResolving(id);
    const { data, error } = await supabase.functions.invoke("resolve-flyer-url", {
      body: { source_id: id, force: true, relearn_selector: opts.relearn, relearn_picker: opts.relearnPicker },
    });
    setResolving(null);
    if (error) return toast.error(error.message);
    const r = data as any;
    if (r?.resolved_url) toast.success(`Resolved via ${r.resolved_via}${r.selector ? " · week selector" : ""}${r.picker ? " · picker" : ""}`);
    else toast.error(r?.error ?? "Resolve failed");
    load();
  };

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Flyer sources</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/deals">Moderation queue</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={runAllActive} disabled={runAll} className="rounded-xl">
              {runAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="ml-1.5">Run all active</span>
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(EMPTY); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl"><Plus className="h-3 w-3 mr-1.5" />Add source</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editing.id ? "Edit" : "Add"} flyer source</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Chain name *</Label><Input value={editing.chain_name ?? ""} onChange={(e) => setEditing({ ...editing, chain_name: e.target.value })} placeholder="Jewel-Osco" /></div>
                  <div><Label>Store name (optional)</Label><Input value={editing.store_name ?? ""} onChange={(e) => setEditing({ ...editing, store_name: e.target.value })} placeholder="Specific store location" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Region</Label><Input value={editing.region ?? ""} onChange={(e) => setEditing({ ...editing, region: e.target.value })} placeholder="IL" /></div>
                    <div><Label>City</Label><Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="Chicago" /></div>
                  </div>
                  <div>
                    <Label>Landing URL (weekly-ad hub)</Label>
                    <Input value={editing.flyer_landing_url ?? ""} onChange={(e) => setEditing({ ...editing, flyer_landing_url: e.target.value })} placeholder="https://www.jewelosco.com/weeklyad" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Stable page we search to find the current week's flyer.</p>
                  </div>
                  <div><Label>Flyer URL * (fallback)</Label><Input value={editing.flyer_url ?? ""} onChange={(e) => setEditing({ ...editing, flyer_url: e.target.value })} placeholder="https://www.jewelosco.com/weeklyad/..." /></div>
                  <div>
                    <Label>Render mode</Label>
                    <Select value={editing.render_mode ?? "html"} onValueChange={(v) => setEditing({ ...editing, render_mode: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">Plain HTML (fast, free)</SelectItem>
                        <SelectItem value="firecrawl">Firecrawl (for JS-rendered sites)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Has week-selector tabs</Label>
                    <Switch checked={editing.requires_week_select ?? false} onCheckedChange={(v) => setEditing({ ...editing, requires_week_select: v })} />
                  </div>
                  {editing.requires_week_select && (
                    <div>
                      <Label>Week selector CSS (auto-learned if empty)</Label>
                      <Input value={editing.week_selector_css ?? ""} onChange={(e) => setEditing({ ...editing, week_selector_css: e.target.value })} placeholder='[data-week="current"]' />
                    </div>
                  )}
                  <div className="border-t pt-3 space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Store / ZIP picker</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Strategy</Label>
                        <Select
                          value={editing.store_picker_strategy ?? "none"}
                          onValueChange={(v) => setEditing({ ...editing, store_picker_strategy: v as any })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="zip">Enter ZIP</SelectItem>
                            <SelectItem value="storeid">Enter store ID</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">ZIP / store ID</Label>
                        <Input value={editing.store_zip ?? ""} onChange={(e) => setEditing({ ...editing, store_zip: e.target.value })} placeholder="60601" />
                      </div>
                    </div>
                    {editing.store_picker_strategy && editing.store_picker_strategy !== "none" && (
                      <>
                        <div>
                          <Label className="text-xs">Input CSS (auto-learned if empty)</Label>
                          <Input value={editing.store_picker_input_css ?? ""} onChange={(e) => setEditing({ ...editing, store_picker_input_css: e.target.value })} placeholder='input[name="zip"]' />
                        </div>
                        <div>
                          <Label className="text-xs">Submit button CSS (optional, falls back to Enter)</Label>
                          <Input value={editing.store_picker_submit_css ?? ""} onChange={(e) => setEditing({ ...editing, store_picker_submit_css: e.target.value })} placeholder='button[type="submit"]' />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  </div>
                  <div><Label>Notes</Label><Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Active sources are scraped weekly. Use "Run now" to trigger an ad-hoc import. Failed sources auto-disable after 3 consecutive failures.
        </p>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : sources.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground rounded-3xl">No sources yet. Add one to start.</Card>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <Card key={s.id} className="p-4 rounded-2xl">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{s.chain_name}</h3>
                      {!s.active && <Badge variant="outline">inactive</Badge>}
                      {s.render_mode === "firecrawl" && <Badge variant="secondary">firecrawl</Badge>}
                      {s.requires_week_select && <Badge variant="secondary">week tabs</Badge>}
                      {s.store_picker_strategy && s.store_picker_strategy !== "none" && (
                        <Badge variant="secondary">picker: {s.store_picker_strategy}{s.store_zip ? ` ${s.store_zip}` : ""}</Badge>
                      )}
                      {s.last_status === "ok" && <Badge className="bg-primary/15 text-primary border-0">last: ok</Badge>}
                      {s.last_status && s.last_status !== "ok" && <Badge variant="destructive">last: {s.last_status}</Badge>}
                      {s.consecutive_failures > 0 && <Badge variant="destructive">{s.consecutive_failures} fails</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[s.city, s.region].filter(Boolean).join(", ")}
                      {s.last_run_at && <> · last run {formatDistanceToNow(new Date(s.last_run_at), { addSuffix: true })}</>}
                    </p>
                    {s.flyer_landing_url && (
                      <a href={s.flyer_landing_url} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mt-1 break-all">
                        landing: {s.flyer_landing_url} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                    <a href={s.last_resolved_url || s.flyer_url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 break-all">
                      {s.last_resolved_url ? <>resolved: {s.last_resolved_url}</> : s.flyer_url} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    {s.week_selector_css && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        selector ({s.week_selector_strategy ?? "click"}): <code>{s.week_selector_css}</code>
                      </p>
                    )}
                    {s.last_error && <p className="text-xs text-destructive mt-1 line-clamp-2">{s.last_error}</p>}
                    {s.last_batch_id && (
                      <Link to={`/admin/deals?batch=${s.last_batch_id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                        Review last batch →
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" onClick={() => runOne(s.id)} disabled={running === s.id} className="rounded-xl">
                      {running === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      <span className="ml-1.5">Run now</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolveOne(s.id)} disabled={resolving === s.id} className="rounded-xl">
                      {resolving === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                      <span className="ml-1.5">Resolve URL</span>
                    </Button>
                    {s.requires_week_select && (
                      <Button size="sm" variant="ghost" onClick={() => resolveOne(s.id, { relearn: true })} disabled={resolving === s.id} className="rounded-xl">
                        <Wand2 className="h-3 w-3 mr-1.5" />Re-learn week
                      </Button>
                    )}
                    {s.store_picker_strategy && s.store_picker_strategy !== "none" && (
                      <Button size="sm" variant="ghost" onClick={() => resolveOne(s.id, { relearnPicker: true })} disabled={resolving === s.id} className="rounded-xl">
                        <Wand2 className="h-3 w-3 mr-1.5" />Re-learn picker
                      </Button>
                    )}
                    <div className="flex items-center gap-1">
                      <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminFlyerSources;
