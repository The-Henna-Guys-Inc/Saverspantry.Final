import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Sparkles, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

type Store = { id: string; name: string; chain_name: string | null; city: string | null; region: string | null };

type Candidate = { id: string; name: string; chain_name: string | null; city: string | null; region: string | null; score: number };

type Batch = {
  id: string;
  store_id: string | null;
  extracted_items_count: number;
  extracted_store_hint: any;
  store_match_candidates: Candidate[] | null;
  store_match_confidence: "high" | "low" | "none" | null;
  extracted_valid_from: string | null;
  extracted_valid_until: string | null;
};

/**
 * Shown after a flyer extraction (upload or URL import) when the batch
 * lands in 'awaiting_confirmation'. Pre-fills the store match + dates
 * from the AI extraction and lets the admin override before deals are
 * inserted into the moderation queue.
 */
export function AdminFlyerConfirmDialog({
  batchId, open, onOpenChange, onConfirmed,
}: {
  batchId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmed?: () => void;
}) {
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);
  const [autoCreatedId, setAutoCreatedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStore, setNewStore] = useState({
    name: "", chain_name: "", address: "", city: "", region: "", zip_code: "", country: "United States",
  });
  const [creatingNew, setCreatingNew] = useState(false);

  const loadStores = async () => {
    const { data: s } = await supabase.from("specialty_stores")
      .select("id, name, chain_name, city, region")
      .eq("active", true).order("name").limit(500);
    setStores((s ?? []) as Store[]);
    return (s ?? []) as Store[];
  };

  useEffect(() => {
    if (!open || !batchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setAutoCreatedId(null);
      setShowCreateForm(false);
      const [{ data: b }, s] = await Promise.all([
        supabase.from("flyer_extraction_batches")
          .select("id, store_id, extracted_items_count, extracted_store_hint, store_match_candidates, store_match_confidence, extracted_valid_from, extracted_valid_until")
          .eq("id", batchId).maybeSingle(),
        loadStores(),
      ]);
      if (cancelled) return;
      const batchRow = (b as Batch | null) ?? null;
      setBatch(batchRow);
      // Pre-fill store: explicit store_id if AI was high-confidence, else top candidate, else nothing
      let preStore = batchRow?.store_id
        ?? batchRow?.store_match_candidates?.[0]?.id
        ?? "";

      // Auto-create from hint when no match was found but AI extracted enough info
      const h = batchRow?.extracted_store_hint;
      const noMatch = !preStore && (!batchRow?.store_match_candidates?.length);
      const enoughDetail = h && (h.name || h.chain_name) && (h.address || h.city);
      if (noMatch && enoughDetail) {
        setAutoCreating(true);
        const created = await createStoreFromHint(h);
        if (!cancelled && created) {
          preStore = created.id;
          setAutoCreatedId(created.id);
          await loadStores();
        }
        if (!cancelled) setAutoCreating(false);
      }
      setStoreId(preStore);

      // Pre-fill new-store form from hint for the manual fallback
      if (h) {
        setNewStore((prev) => ({
          ...prev,
          name: h.name ?? prev.name,
          chain_name: h.chain_name ?? prev.chain_name,
          address: h.address ?? prev.address,
          city: h.city ?? prev.city,
          region: h.region ?? prev.region,
          zip_code: h.zip ?? prev.zip_code,
        }));
      }

      // Pre-fill dates: AI-extracted, else today + 7 days
      const today = new Date().toISOString().slice(0, 10);
      const week = new Date(); week.setDate(week.getDate() + 7);
      setValidFrom(batchRow?.extracted_valid_from ?? today);
      setValidUntil(batchRow?.extracted_valid_until ?? week.toISOString().slice(0, 10));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [batchId, open]);

  const createStoreFromHint = async (h: any): Promise<{ id: string } | null> => {
    const name = String(h?.name ?? h?.chain_name ?? "").trim();
    if (!name) return null;
    const { data, error } = await supabase.from("specialty_stores").insert({
      name,
      chain_name: h?.chain_name ?? null,
      address: h?.address ?? null,
      city: h?.city ?? null,
      region: h?.region ?? null,
      zip_code: h?.zip ?? null,
      country: h?.country ?? "United States",
      cuisine_specialties: [],
      price_tier: "$$",
      curation_source: "admin_curated",
      active: true,
    }).select("id").maybeSingle();
    if (error) {
      toast.error(`Auto-create store failed: ${error.message}`);
      return null;
    }
    if (data?.id) toast.success(`Added "${name}" to stores`);
    return data;
  };

  const submitNewStore = async () => {
    if (!newStore.name.trim()) return toast.error("Store name required");
    setCreatingNew(true);
    const created = await createStoreFromHint({
      name: newStore.name,
      chain_name: newStore.chain_name || null,
      address: newStore.address || null,
      city: newStore.city || null,
      region: newStore.region || null,
      zip: newStore.zip_code || null,
      country: newStore.country || null,
    });
    if (created?.id) {
      await loadStores();
      setStoreId(created.id);
      setAutoCreatedId(created.id);
      setShowCreateForm(false);
    }
    setCreatingNew(false);
  };


  const filteredStores = useMemo(() => {
    if (!storeQuery.trim()) return stores.slice(0, 50);
    const q = storeQuery.toLowerCase();
    return stores.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.chain_name?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [stores, storeQuery]);

  const candidates = batch?.store_match_candidates ?? [];
  const hint = batch?.extracted_store_hint;
  const confidence = batch?.store_match_confidence ?? "none";

  const confirm = async () => {
    if (!batchId) return;
    if (!storeId) return toast.error("Pick a store");
    if (!validFrom || !validUntil) return toast.error("Set valid-from and valid-until dates");
    if (new Date(validUntil) <= new Date(validFrom)) return toast.error("Valid-until must be after valid-from");

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-flyer-batch", {
        body: { batch_id: batchId, store_id: storeId, valid_from: validFrom, valid_until: validUntil },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      toast.success(`Imported ${d?.inserted ?? 0} deal${d?.inserted === 1 ? "" : "s"} to moderation`);
      onOpenChange(false);
      onConfirmed?.();
      navigate(`/admin/deals?batch=${batchId}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Confirmation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Confirm flyer details
          </DialogTitle>
          <DialogDescription>
            AI extracted {batch?.extracted_items_count ?? "…"} deal{batch?.extracted_items_count === 1 ? "" : "s"}.
            Confirm the store and validity window before sending them to moderation.
          </DialogDescription>
        </DialogHeader>

        {loading || !batch ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 py-2">
            {/* AI extraction summary */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                {confidence === "high" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                {confidence === "low" && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                Extracted from flyer
              </div>
              {hint?.name || hint?.chain_name ? (
                <p className="text-muted-foreground">
                  Store: <span className="text-foreground">{hint.name ?? "—"}{hint.chain_name ? ` (${hint.chain_name})` : ""}</span>
                </p>
              ) : (
                <p className="text-muted-foreground italic">No store info detected on flyer</p>
              )}
              {hint?.address && (
                <p className="text-muted-foreground">Address: <span className="text-foreground">{hint.address}</span></p>
              )}
              {(hint?.city || hint?.region || hint?.zip) && (
                <p className="text-muted-foreground">
                  Location: <span className="text-foreground">{[hint.city, hint.region, hint.zip].filter(Boolean).join(", ")}</span>
                </p>
              )}
              {(batch.extracted_valid_from || batch.extracted_valid_until) && (
                <p className="text-muted-foreground">
                  Dates: <span className="text-foreground">{batch.extracted_valid_from ?? "?"} → {batch.extracted_valid_until ?? "?"}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                Match confidence: <span className="font-medium text-foreground">{confidence}</span>
              </p>
            </div>

            {/* Store picker */}
            <div className="space-y-2">
              <Label>Store</Label>

              {autoCreating && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Adding extracted store to curated list…
                </div>
              )}
              {autoCreatedId && storeId === autoCreatedId && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Auto-added <b>{stores.find(s => s.id === autoCreatedId)?.name ?? "store"}</b> to the curated stores list from the flyer.</span>
                </div>
              )}

              {candidates.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Top matches:</p>
                  <div className="flex flex-col gap-1.5">
                    {candidates.slice(0, 3).map((c) => (
                      <button
                        key={c.id} type="button"
                        onClick={() => setStoreId(c.id)}
                        className={`text-left rounded-xl border px-3 py-2 text-sm hover:bg-muted/50 ${storeId === c.id ? "border-primary bg-primary/5" : "border-border"}`}
                        disabled={busy}
                      >
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[c.chain_name, c.city, c.region].filter(Boolean).join(" · ") || "—"} · score {c.score}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Input
                placeholder="Or search all stores by name, chain, city…"
                value={storeQuery}
                onChange={(e) => setStoreQuery(e.target.value)}
                disabled={busy}
              />
              {storeQuery && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                  {filteredStores.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No stores match.</div>
                  ) : filteredStores.map((s) => (
                    <button
                      key={s.id} type="button"
                      onClick={() => { setStoreId(s.id); setStoreQuery(""); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${storeId === s.id ? "bg-primary/10" : ""}`}
                      disabled={busy}
                    >
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[s.chain_name, s.city, s.region].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {storeId && (
                <p className="text-xs text-primary">
                  Selected: {stores.find((s) => s.id === storeId)?.name ?? candidates.find((c) => c.id === storeId)?.name ?? storeId}
                </p>
              )}

              {!showCreateForm ? (
                <Button
                  type="button" variant="outline" size="sm"
                  className="w-full rounded-xl"
                  onClick={() => setShowCreateForm(true)}
                  disabled={busy}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add a new store{hint?.name ? " (pre-filled from flyer)" : ""}
                </Button>
              ) : (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-semibold">New store</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Name *" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} disabled={creatingNew} />
                    <Input placeholder="Chain (optional)" value={newStore.chain_name} onChange={(e) => setNewStore({ ...newStore, chain_name: e.target.value })} disabled={creatingNew} />
                    <Input className="col-span-2" placeholder="Address" value={newStore.address} onChange={(e) => setNewStore({ ...newStore, address: e.target.value })} disabled={creatingNew} />
                    <Input placeholder="City" value={newStore.city} onChange={(e) => setNewStore({ ...newStore, city: e.target.value })} disabled={creatingNew} />
                    <Input placeholder="Region / State" value={newStore.region} onChange={(e) => setNewStore({ ...newStore, region: e.target.value })} disabled={creatingNew} />
                    <Input placeholder="ZIP" value={newStore.zip_code} onChange={(e) => setNewStore({ ...newStore, zip_code: e.target.value })} disabled={creatingNew} />
                    <Input placeholder="Country" value={newStore.country} onChange={(e) => setNewStore({ ...newStore, country: e.target.value })} disabled={creatingNew} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} disabled={creatingNew}>Cancel</Button>
                    <Button type="button" size="sm" onClick={submitNewStore} disabled={creatingNew || !newStore.name.trim()} className="rounded-xl">
                      {creatingNew ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Plus className="h-3 w-3 mr-1.5" />}
                      Create &amp; select
                    </Button>
                  </div>
                </div>
              )}
            </div>


            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cvf">Valid from</Label>
                <Input id="cvf" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cvu">Valid until</Label>
                <Input id="cvu" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={busy} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={busy || !storeId || !batch} className="rounded-xl">
            {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
            Confirm &amp; send to moderation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
