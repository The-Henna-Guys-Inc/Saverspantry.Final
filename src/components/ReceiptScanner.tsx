import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Loader2, Camera, RotateCcw, Trash2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "add" | "remove";

type ParsedItem = {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  raw_text?: string;
};

type EditableItem = ParsedItem & {
  _key: string;
  location: string; // for add mode
  expires: string;  // for add mode (YYYY-MM-DD)
  matchedId?: string | null; // for remove mode
  matchedName?: string | null;
  matchedQty?: number | null;
  matchedUnit?: string | null;
};

export type PantryItemLite = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  location: string;
};

const UNITS = ["unit", "g", "kg", "oz", "lb", "ml", "L", "cup", "tbsp", "tsp"];
const CATEGORIES = ["produce", "protein", "dairy", "pantry", "frozen", "bakery", "other"];

async function fileToCompressedBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.8);
}

function fuzzyMatch(name: string, pantry: PantryItemLite[]): PantryItemLite | null {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  // exact contains
  let best: { item: PantryItemLite; score: number } | null = null;
  for (const it of pantry) {
    const i = it.item.toLowerCase();
    let score = 0;
    if (i === n) score = 100;
    else if (i.includes(n) || n.includes(i)) score = 80;
    else {
      const tokens = n.split(/\s+/).filter((t) => t.length > 2);
      const matches = tokens.filter((t) => i.includes(t)).length;
      if (matches > 0) score = 40 + matches * 10;
    }
    if (score > 0 && (!best || score > best.score)) best = { item: it, score };
  }
  return best && best.score >= 50 ? best.item : null;
}

interface Props {
  mode: Mode;
  userId: string;
  pantry: PantryItemLite[];
  locations: string[];
  defaultLocation?: string;
  onAdded?: (rows: any[]) => void;
  onRemoved?: (updates: { id: string; newQuantity: number; usedQty: number; unit: string; itemName: string; expires_on: string | null }[]) => void;
  trigger?: React.ReactNode;
}

export const ReceiptScanner = ({ mode, userId, pantry, locations, defaultLocation = "pantry", onAdded, onRemoved, trigger }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const reset = () => { setPreview(null); setItems([]); setStoreName(null); };

  const handleFile = async (file: File) => {
    setBusy(true);
    setItems([]);
    try {
      const b64 = await fileToCompressedBase64(file);
      setPreview(b64);
      const { data, error } = await supabase.functions.invoke("pantry-receipt-parse", { body: { imageBase64: b64, mode } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const parsed: ParsedItem[] = data?.items ?? [];
      if (parsed.length === 0) {
        toast.error("Couldn't read any items. Try a sharper, well-lit photo.");
        return;
      }
      setStoreName(data?.store_name ?? null);
      setItems(parsed.map((p, idx) => {
        const match = mode === "remove" ? fuzzyMatch(p.name, pantry) : null;
        return {
          ...p,
          _key: `${Date.now()}-${idx}`,
          location: defaultLocation,
          expires: "",
          matchedId: match?.id ?? null,
          matchedName: match?.item ?? null,
          matchedQty: match?.quantity ?? null,
          matchedUnit: match?.unit ?? null,
        };
      }));
      toast.success(`Found ${parsed.length} item${parsed.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (key: string, patch: Partial<EditableItem>) => {
    setItems((p) => p.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  };
  const removeRow = (key: string) => setItems((p) => p.filter((it) => it._key !== key));
  const addRow = () => {
    setItems((p) => [
      ...p,
      { _key: `${Date.now()}-new`, name: "", quantity: 1, unit: "unit", category: "pantry", location: defaultLocation, expires: "" },
    ]);
  };

  const commitAdd = async () => {
    const valid = items.filter((it) => it.name.trim() && it.quantity > 0);
    if (valid.length === 0) { toast.error("Nothing to add"); return; }
    setCommitting(true);
    try {
      const rows = valid.map((it) => ({
        user_id: userId,
        item: it.name.trim(),
        quantity: it.quantity,
        unit: it.unit,
        category: it.category,
        location: it.location,
        expires_on: it.expires || null,
      }));
      const { data, error } = await supabase
        .from("pantry_items")
        .insert(rows)
        .select("id, item, quantity, unit, category, location, expires_on, low_stock_threshold, image_url, barcode");
      if (error) throw error;
      toast.success(`Added ${rows.length} item${rows.length === 1 ? "" : "s"} to pantry`);
      onAdded?.(data ?? []);
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add items");
    } finally {
      setCommitting(false);
    }
  };

  const commitRemove = async () => {
    const valid = items.filter((it) => it.matchedId && it.quantity > 0);
    if (valid.length === 0) { toast.error("No matched items to remove. Match items to your pantry first."); return; }
    setCommitting(true);
    try {
      const updates: { id: string; newQuantity: number; usedQty: number; unit: string; itemName: string; expires_on: string | null }[] = [];
      const consumptionRows: any[] = [];
      for (const it of valid) {
        const match = pantry.find((p) => p.id === it.matchedId);
        if (!match) continue;
        const next = Math.max(0, Number((match.quantity - it.quantity).toFixed(2)));
        const { error } = await supabase
          .from("pantry_items")
          .update({ quantity: next })
          .eq("id", match.id);
        if (error) throw error;
        updates.push({ id: match.id, newQuantity: next, usedQty: it.quantity, unit: match.unit, itemName: match.item, expires_on: null });
        consumptionRows.push({
          user_id: userId,
          pantry_item_id: match.id,
          item_name: match.item,
          quantity_used: it.quantity,
          unit: match.unit,
        });
      }
      if (consumptionRows.length > 0) {
        await supabase.from("pantry_consumption_log").insert(consumptionRows);
      }
      toast.success(`Removed ${updates.length} item${updates.length === 1 ? "" : "s"} from pantry`);
      onRemoved?.(updates);
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove items");
    } finally {
      setCommitting(false);
    }
  };

  const title = mode === "add" ? "Scan a receipt" : "Scan removal note";
  const description = mode === "add"
    ? "Snap a photo of your grocery receipt — we'll add the items to your pantry."
    : "Snap a photo of your handwritten or typed list — we'll match items and remove them from your pantry.";

  return (
    <>
      <span onClick={() => { reset(); setOpen(true); }}>
        {trigger ?? (
          <Button variant="outline" className="rounded-xl">
            <Receipt className="h-4 w-4 mr-2" />
            {mode === "add" ? "Scan receipt" : "Scan removal list"}
          </Button>
        )}
      </span>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="rounded-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Receipt className="h-5 w-5" /> {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {!preview && !busy && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Button variant="hero" className="rounded-xl h-12 px-6" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" /> Take or upload photo
              </Button>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Hold the phone steady, fill the frame with the {mode === "add" ? "receipt" : "list"}, and make sure the text is in focus.
              </p>
            </div>
          )}

          {busy && (
            <div className="flex flex-col items-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Reading items…
            </div>
          )}

          {preview && !busy && items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img src={preview} alt="Scanned" className="h-16 w-16 rounded-lg object-cover border border-border" />
                <div className="flex-1 min-w-0">
                  {storeName && <div className="text-xs uppercase tracking-wider text-muted-foreground">{storeName}</div>}
                  <div className="text-sm font-medium">{items.length} item{items.length === 1 ? "" : "s"} detected</div>
                  <div className="text-xs text-muted-foreground">Review, edit, then confirm.</div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => fileRef.current?.click()}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retake
                </Button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 -mr-1">
                {items.map((it) => (
                  <div key={it._key} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 sm:col-span-5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item</Label>
                        <Input
                          value={it.name}
                          onChange={(e) => updateItem(it._key, { name: e.target.value })}
                          className="rounded-lg mt-1 h-9"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Qty</Label>
                        <Input
                          type="number" min={0} step="0.1"
                          value={it.quantity}
                          onChange={(e) => updateItem(it._key, { quantity: Number(e.target.value) || 0 })}
                          className="rounded-lg mt-1 h-9"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Unit</Label>
                        <Select value={it.unit} onValueChange={(v) => updateItem(it._key, { unit: v })}>
                          <SelectTrigger className="rounded-lg mt-1 h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {mode === "add" ? (
                        <>
                          <div className="col-span-4 sm:col-span-3">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</Label>
                            <Select value={it.category} onValueChange={(v) => updateItem(it._key, { category: v })}>
                              <SelectTrigger className="rounded-lg mt-1 h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-6 sm:col-span-5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</Label>
                            <Select value={it.location} onValueChange={(v) => updateItem(it._key, { location: v })}>
                              <SelectTrigger className="rounded-lg mt-1 h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>{locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-5 sm:col-span-4">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Expires</Label>
                            <Input
                              type="date"
                              value={it.expires}
                              onChange={(e) => updateItem(it._key, { expires: e.target.value })}
                              className="rounded-lg mt-1 h-9"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="col-span-10 sm:col-span-5">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Match in pantry</Label>
                          <Select
                            value={it.matchedId ?? "__none"}
                            onValueChange={(v) => {
                              if (v === "__none") {
                                updateItem(it._key, { matchedId: null, matchedName: null, matchedQty: null, matchedUnit: null });
                              } else {
                                const m = pantry.find((p) => p.id === v);
                                updateItem(it._key, {
                                  matchedId: v,
                                  matchedName: m?.item ?? null,
                                  matchedQty: m?.quantity ?? null,
                                  matchedUnit: m?.unit ?? null,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="rounded-lg mt-1 h-9">
                              <SelectValue placeholder="No match — skip" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">No match — skip</SelectItem>
                              {pantry.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.item} ({p.quantity} {p.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeRow(it._key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {mode === "remove" && (
                      <div className="mt-2 text-xs flex items-center gap-1.5">
                        {it.matchedId ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Matched: {it.matchedName} — {it.matchedQty} {it.matchedUnit} on hand
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            No pantry match — pick one or skip
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button variant="ghost" size="sm" onClick={addRow} className="rounded-xl w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add another row
              </Button>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-xl" onClick={() => { setOpen(false); reset(); }} disabled={committing}>
                  Cancel
                </Button>
                <Button
                  variant="hero"
                  className="rounded-xl"
                  onClick={mode === "add" ? commitAdd : commitRemove}
                  disabled={committing}
                >
                  {committing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {mode === "add" ? `Add ${items.length} to pantry` : `Remove from pantry`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
