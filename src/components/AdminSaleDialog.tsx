import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export type EditableSale = {
  id: string;
  food_name: string;
  title: string;
  store_name: string;
  store_chain: string | null;
  sale_price_usd: number;
  regular_price_usd: number | null;
  pack_size: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  google_maps_url: string | null;
  ends_at: string;
};

const emptyForm = {
  food_name: "", title: "", store_name: "", store_chain: "",
  sale_price_usd: "", regular_price_usd: "", pack_size: "",
  address: "", city: "", region: "", google_maps_url: "",
  ends_in_days: "7",
};

function autoMapsUrl(store: string, address: string, city: string, region: string) {
  const q = [store, address, city, region].map((s) => s.trim()).filter(Boolean).join(" ");
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function AdminSaleDialog({
  userId, onCreated, sale, trigger,
}: {
  userId: string;
  onCreated: () => void;
  sale?: EditableSale;
  trigger?: React.ReactNode;
}) {
  const isEdit = !!sale;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (sale) {
      const daysLeft = Math.max(1, Math.round((new Date(sale.ends_at).getTime() - Date.now()) / 86400000));
      setForm({
        food_name: sale.food_name ?? "",
        title: sale.title ?? "",
        store_name: sale.store_name ?? "",
        store_chain: sale.store_chain ?? "",
        sale_price_usd: String(sale.sale_price_usd ?? ""),
        regular_price_usd: sale.regular_price_usd != null ? String(sale.regular_price_usd) : "",
        pack_size: sale.pack_size ?? "",
        address: sale.address ?? "",
        city: sale.city ?? "",
        region: sale.region ?? "",
        google_maps_url: sale.google_maps_url ?? "",
        ends_in_days: String(daysLeft),
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, sale]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.food_name || !form.title || !form.store_name || !form.sale_price_usd) {
      toast.error("Food, title, store, and sale price are required.");
      return;
    }
    const salePrice = parseFloat(form.sale_price_usd);
    const reg = form.regular_price_usd ? parseFloat(form.regular_price_usd) : null;
    const savings_pct = reg && reg > salePrice ? Math.round(((reg - salePrice) / reg) * 100) : null;
    const ends_at = new Date(Date.now() + parseInt(form.ends_in_days || "7", 10) * 86400000).toISOString();
    const mapsUrl = form.google_maps_url.trim() || autoMapsUrl(form.store_name, form.address, form.city, form.region);

    const payload = {
      food_name: form.food_name.trim(),
      title: form.title.trim(),
      store_name: form.store_name.trim(),
      store_chain: form.store_chain.trim() || null,
      sale_price_usd: salePrice,
      regular_price_usd: reg,
      savings_pct,
      pack_size: form.pack_size.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      region: form.region.trim() || null,
      google_maps_url: mapsUrl,
    };

    setSaving(true);
    let error;
    if (isEdit && sale) {
      ({ error } = await supabase
        .from("sale_observations")
        .update({ ...payload, ends_at })
        .eq("id", sale.id));
    } else {
      ({ error } = await supabase.from("sale_observations").insert({
        ...payload,
        ends_at,
        source: "admin_curated",
        moderation_status: "approved",
        submitted_by_user_id: userId,
      }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Deal updated." : "Deal published.");
    setOpen(false);
    if (!isEdit) setForm(emptyForm);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="hero" size="sm" className="rounded-xl h-8 px-3 text-xs">
            {isEdit ? <Pencil className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            {isEdit ? "Edit" : "Curate"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit sale" : "Add a curated sale"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Field label="Food name *" hint="e.g. basmati rice"><Input value={form.food_name} onChange={(e) => set("food_name", e.target.value)} /></Field>
          <Field label="Headline *" hint="e.g. Royal basmati 20 lb — $5 off"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Store *"><Input value={form.store_name} onChange={(e) => set("store_name", e.target.value)} /></Field>
          <Field label="Chain"><Input value={form.store_chain} onChange={(e) => set("store_chain", e.target.value)} /></Field>
          <Field label="Sale price (USD) *"><Input type="number" step="0.01" value={form.sale_price_usd} onChange={(e) => set("sale_price_usd", e.target.value)} /></Field>
          <Field label="Regular price (USD)"><Input type="number" step="0.01" value={form.regular_price_usd} onChange={(e) => set("regular_price_usd", e.target.value)} /></Field>
          <Field label="Pack size"><Input value={form.pack_size} onChange={(e) => set("pack_size", e.target.value)} /></Field>
          <Field label={isEdit ? "Ends in (days from now)" : "Ends in (days)"}><Input type="number" value={form.ends_in_days} onChange={(e) => set("ends_in_days", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Region / state"><Input value={form.region} onChange={(e) => set("region", e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Street address" hint="e.g. 1681 Oak Tree Rd"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Google Maps URL" hint="Paste a maps.google.com link, or leave blank to auto-generate from address"><Input value={form.google_maps_url} onChange={(e) => set("google_maps_url", e.target.value)} placeholder="https://maps.google.com/..." /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="hero" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} {isEdit ? "Save" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
