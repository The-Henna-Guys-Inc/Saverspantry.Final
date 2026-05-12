import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

type Store = { id: string; name: string; chain_name: string | null; city: string | null; region: string | null };

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function AdminFlyerUpload({ userId, onComplete }: { userId: string; onComplete?: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [storeQuery, setStoreQuery] = useState("");
  const [validFrom, setValidFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("specialty_stores")
        .select("id, name, chain_name, city, region")
        .eq("active", true)
        .order("name")
        .limit(500);
      setStores((data ?? []) as Store[]);
    })();
  }, [open]);

  const filteredStores = stores.filter((s) => {
    if (!storeQuery.trim()) return true;
    const q = storeQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.chain_name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q);
  }).slice(0, 50);

  const onPick = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Use PDF, JPG, PNG or WEBP");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Max 20MB");
      return;
    }
    setFile(f);
  };

  const reset = () => {
    setFile(null); setStoreId(""); setStoreQuery(""); setStage("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!storeId) return toast.error("Pick a store");
    if (!file) return toast.error("Choose a flyer file");
    if (!validFrom || !validUntil) return toast.error("Set valid-from and valid-until dates");
    if (new Date(validUntil) <= new Date(validFrom)) return toast.error("Valid-until must be after valid-from");

    setBusy(true);
    try {
      // 1. Create batch row
      setStage("Creating batch…");
      const ext = file.name.split(".").pop() || "bin";
      const { data: batch, error: batchErr } = await supabase
        .from("flyer_extraction_batches")
        .insert({
          store_id: storeId,
          admin_user_id: userId,
          original_filename: file.name,
          stored_file_url: "pending", // updated after upload
          file_type: file.type,
          flyer_valid_from: new Date(validFrom).toISOString(),
          flyer_valid_until: new Date(validUntil).toISOString(),
          extraction_status: "pending",
        })
        .select("id")
        .single();
      if (batchErr || !batch) throw new Error(batchErr?.message ?? "Could not create batch");

      // 2. Upload file
      setStage("Uploading flyer…");
      const path = `${batch.id}/flyer.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("flyer-uploads")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw new Error(upErr.message);

      await supabase.from("flyer_extraction_batches")
        .update({ stored_file_url: path })
        .eq("id", batch.id);

      // 3. Invoke extraction
      setStage("Extracting deals with AI…");
      const { data, error } = await supabase.functions.invoke("extract-flyer-deals", {
        body: { batch_id: batch.id },
      });
      if (error) throw new Error(error.message);

      const extracted = (data as any)?.extracted ?? 0;
      toast.success(`Extracted ${extracted} deal${extracted === 1 ? "" : "s"}. Review them next.`);
      setOpen(false);
      reset();
      onComplete?.();
      navigate(`/admin/deals?batch=${batch.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-xs">
          <Sparkles className="h-3 w-3 mr-1.5" /> Upload flyer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Extract deals from a flyer</DialogTitle>
          <DialogDescription>
            Upload a weekly ad (PDF/JPG/PNG, ≤20MB). AI will pull each item; you'll review them in the moderation queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Store</Label>
            <Input
              placeholder="Search by name, chain, or city…"
              value={storeQuery}
              onChange={(e) => setStoreQuery(e.target.value)}
              disabled={busy}
            />
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {filteredStores.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">No stores match.</div>
              ) : filteredStores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStoreId(s.id)}
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vf">Valid from</Label>
              <Input id="vf" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vu">Valid until</Label>
              <Input id="vu" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={busy} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Flyer file</Label>
            <Input
              id="file"
              ref={fileRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
            {file && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>
            )}
          </div>

          {stage && (
            <div className="text-xs text-primary flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> {stage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !file || !storeId}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Upload className="h-3 w-3 mr-1.5" />}
            Extract deals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
