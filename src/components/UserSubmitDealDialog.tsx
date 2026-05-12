import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompress";

const empty = {
  food_name: "", title: "", store_name: "", store_chain: "",
  sale_price_usd: "", regular_price_usd: "", pack_size: "",
  city: "", region: "", address: "", ends_in_days: "7", category: "",
};

export function UserSubmitDealDialog({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = async (file: File) => {
    try {
      const blob = await compressImage(file);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      toast.error((e as Error).message || "Could not process image");
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!form.food_name.trim() || !form.title.trim() || !form.store_name.trim() || !form.sale_price_usd) {
      toast.error("Food, headline, store, and sale price are required.");
      return;
    }
    const salePrice = parseFloat(form.sale_price_usd);
    const reg = form.regular_price_usd ? parseFloat(form.regular_price_usd) : null;
    if (!Number.isFinite(salePrice) || salePrice <= 0) return toast.error("Invalid sale price");
    if (reg != null && (!Number.isFinite(reg) || reg <= 0)) return toast.error("Invalid regular price");

    setSaving(true);
    try {
      let photo_url: string | null = null;
      if (photo) {
        const path = `${user.id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("deal-submissions")
          .upload(path, photo.blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("deal-submissions")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        photo_url = signed?.signedUrl ?? null;
      }

      const { data, error } = await supabase.functions.invoke("submit-deal", {
        body: {
          food_name: form.food_name.trim(),
          title: form.title.trim(),
          store_name: form.store_name.trim(),
          store_chain: form.store_chain.trim() || null,
          sale_price_usd: salePrice,
          regular_price_usd: reg,
          pack_size: form.pack_size.trim() || null,
          city: form.city.trim() || null,
          region: form.region.trim() || null,
          address: form.address.trim() || null,
          category: form.category.trim() || null,
          ends_in_days: parseInt(form.ends_in_days || "7", 10),
          photo_url,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(
        (data as any)?.moderation_status === "pending_review"
          ? "Submitted for review. Thanks!"
          : "Deal posted. Thanks for sharing!",
      );
      setForm(empty);
      setPhoto(null);
      setOpen(false);
      onSubmitted?.();
    } catch (e) {
      toast.error((e as Error).message || "Could not submit deal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="sm" className="rounded-xl h-8 px-3 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Submit a deal
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share a deal you spotted</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Help your neighbors save. Up to 5 submissions per day.
        </p>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Field label="Food name *"><Input value={form.food_name} onChange={(e) => set("food_name", e.target.value)} maxLength={80} /></Field>
          <Field label="Headline *"><Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={140} /></Field>
          <Field label="Store *"><Input value={form.store_name} onChange={(e) => set("store_name", e.target.value)} maxLength={120} /></Field>
          <Field label="Chain"><Input value={form.store_chain} onChange={(e) => set("store_chain", e.target.value)} maxLength={80} /></Field>
          <Field label="Sale price (USD) *"><Input type="number" step="0.01" value={form.sale_price_usd} onChange={(e) => set("sale_price_usd", e.target.value)} /></Field>
          <Field label="Regular price (USD)"><Input type="number" step="0.01" value={form.regular_price_usd} onChange={(e) => set("regular_price_usd", e.target.value)} /></Field>
          <Field label="Pack size"><Input value={form.pack_size} onChange={(e) => set("pack_size", e.target.value)} maxLength={60} /></Field>
          <Field label="Ends in (days)"><Input type="number" min={1} max={60} value={form.ends_in_days} onChange={(e) => set("ends_in_days", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} /></Field>
          <Field label="Region / state"><Input value={form.region} onChange={(e) => set("region", e.target.value)} maxLength={80} /></Field>
          <div className="col-span-2"><Field label="Street address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={200} /></Field></div>
          <div className="col-span-2">
            <Label className="text-xs">Photo (optional)</Label>
            {photo ? (
              <div className="relative mt-1 inline-block">
                <img src={photo.preview} alt="Preview" className="h-32 rounded-xl object-cover" />
                <button type="button" onClick={() => setPhoto(null)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-soft">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border cursor-pointer hover:bg-secondary text-xs text-muted-foreground w-fit">
                <ImagePlus className="h-4 w-4" /> Add a photo of the price tag
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="hero" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
