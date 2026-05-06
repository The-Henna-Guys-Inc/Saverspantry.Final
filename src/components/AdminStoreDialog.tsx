import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export type EditableStore = {
  id: string;
  name: string;
  chain_name: string | null;
  cuisine_specialties: string[];
  price_tier: string;
  description: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
};

const CUISINES = [
  "indian", "chinese", "korean", "japanese", "vietnamese",
  "mexican", "middle_eastern", "filipino",
];
const TIERS = ["low", "medium", "high", "unknown"];

const empty = {
  name: "", chain_name: "", price_tier: "unknown", description: "",
  address: "", city: "", region: "", cuisines: "" as string,
};

export function AdminStoreDialog({
  onSaved, store, trigger,
}: {
  onSaved: () => void;
  store?: EditableStore;
  trigger?: React.ReactNode;
}) {
  const isEdit = !!store;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    if (store) {
      setForm({
        name: store.name ?? "",
        chain_name: store.chain_name ?? "",
        price_tier: store.price_tier ?? "unknown",
        description: store.description ?? "",
        address: store.address ?? "",
        city: store.city ?? "",
        region: store.region ?? "",
        cuisines: (store.cuisine_specialties ?? []).join(","),
      });
    } else setForm(empty);
  }, [open, store]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCuisine = (c: string) => {
    const list = form.cuisines.split(",").map((x) => x.trim()).filter(Boolean);
    const next = list.includes(c) ? list.filter((x) => x !== c) : [...list, c];
    set("cuisines", next.join(","));
  };
  const active = form.cuisines.split(",").map((x) => x.trim()).filter(Boolean);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Store name is required.");
    const payload = {
      name: form.name.trim(),
      chain_name: form.chain_name.trim() || null,
      price_tier: form.price_tier || "unknown",
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      region: form.region.trim() || null,
      cuisine_specialties: active,
    };
    setSaving(true);
    let error;
    if (isEdit && store) {
      ({ error } = await supabase.from("specialty_stores").update(payload).eq("id", store.id));
    } else {
      ({ error } = await supabase.from("specialty_stores").insert({ ...payload, curation_source: "admin_curated" }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Store updated." : "Store published.");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="hero" size="sm" className="rounded-xl">
            {isEdit ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {isEdit ? "Edit" : "Curate store"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit store" : "Add a curated store"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Field label="Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Chain"><Input value={form.chain_name} onChange={(e) => set("chain_name", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Region / state"><Input value={form.region} onChange={(e) => set("region", e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
          <Field label="Price tier">
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.price_tier} onChange={(e) => set("price_tier", e.target.value)}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Label className="text-xs">Cuisines</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CUISINES.map((c) => (
                <button key={c} type="button" onClick={() => toggleCuisine(c)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-smooth ${
                    active.includes(c) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
                  }`}>
                  {c.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></Field></div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
