import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Store = { id: string; name: string; chain_name: string | null; city: string | null; region: string | null };

export function AdminFlyerUrlImport({ userId, onComplete }: { userId: string; onComplete?: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [autoMatched, setAutoMatched] = useState(false);
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("specialty_stores")
        .select("id, name, chain_name, city, region")
        .eq("active", true).order("name").limit(500);
      setStores((data ?? []) as Store[]);
    })();
  }, [open]);

  // Auto-match store by URL domain via store_email_aliases (match_type='from_domain')
  const domain = useMemo(() => {
    try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
    catch { return ""; }
  }, [url]);

  useEffect(() => {
    if (!domain || !open) { setAutoMatched(false); return; }
    (async () => {
      const { data } = await supabase
        .from("store_email_aliases")
        .select("store_id")
        .eq("match_type", "from_domain")
        .eq("match_value", domain)
        .maybeSingle();
      if (data?.store_id) {
        setStoreId(data.store_id);
        setAutoMatched(true);
      } else {
        setAutoMatched(false);
      }
    })();
  }, [domain, open]);

  const filteredStores = stores.filter((s) => {
    if (!storeQuery.trim()) return true;
    const q = storeQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.chain_name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q);
  }).slice(0, 50);

  const reset = () => {
    setUrl(""); setStoreId(""); setStoreQuery(""); setAutoMatched(false); setStage("");
  };

  const submit = async () => {
    if (!url) return toast.error("Paste a flyer URL");
    if (!storeId) return toast.error("Pick a store");
    if (!validFrom || !validUntil) return toast.error("Set valid-from and valid-until dates");
    if (new Date(validUntil) <= new Date(validFrom)) return toast.error("Valid-until must be after valid-from");

    setBusy(true);
    setStage("Fetching URL and extracting deals…");
    try {
      const { data, error } = await supabase.functions.invoke("import-flyer-from-url", {
        body: { url, store_id: storeId, valid_from: validFrom, valid_until: validUntil },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.error) throw new Error(d.error);

      const batchId = d?.batch_id ?? d?.extracted?.batch_id;
      const count = d?.extracted?.extracted ?? d?.extracted ?? d?.inserted ?? 0;
      toast.success(`Imported ${count} deal${count === 1 ? "" : "s"}. Review them next.`);
      setOpen(false); reset(); onComplete?.();
      if (batchId) navigate(`/admin/deals?batch=${batchId}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setBusy(false); setStage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-xs">
          <Link2 className="h-3 w-3 mr-1.5" /> Import from URL
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import deals from a URL</DialogTitle>
          <DialogDescription>
            Works best with direct PDF/image flyer links and simple HTML weekly-ad pages.
            JS-only viewers (Flipp, Circular.com) won't return readable text — use a direct PDF link instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="url">Flyer URL</Label>
            <Input id="url" type="url" placeholder="https://…" value={url}
              onChange={(e) => setUrl(e.target.value)} disabled={busy} />
            {domain && (
              <p className="text-xs text-muted-foreground">Domain: <span className="font-mono">{domain}</span></p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Store</Label>
              {autoMatched && (
                <span className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> auto-matched by domain
                </span>
              )}
            </div>
            <Input placeholder="Search by name, chain, or city…"
              value={storeQuery} onChange={(e) => setStoreQuery(e.target.value)} disabled={busy} />
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {filteredStores.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">No stores match.</div>
              ) : filteredStores.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => { setStoreId(s.id); setAutoMatched(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${storeId === s.id ? "bg-primary/10" : ""}`}
                  disabled={busy}>
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[s.chain_name, s.city, s.region].filter(Boolean).join(" · ") || "—"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vf2">Valid from</Label>
              <Input id="vf2" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vu2">Valid until</Label>
              <Input id="vu2" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={busy} />
            </div>
          </div>

          {stage && (
            <div className="text-xs text-primary flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> {stage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !url || !storeId}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
            Import deals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
