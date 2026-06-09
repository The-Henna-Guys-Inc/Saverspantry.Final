import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { AdminFlyerConfirmDialog } from "./AdminFlyerConfirmDialog";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function AdminFlyerUpload({ userId, onComplete }: { userId: string; onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [confirmBatchId, setConfirmBatchId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (!ACCEPTED.includes(f.type)) return toast.error("Use PDF, JPG, PNG or WEBP");
    if (f.size > MAX_BYTES) return toast.error("Max 20MB");
    setFile(f);
  };

  const reset = () => {
    setFile(null); setStage("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!file) return toast.error("Choose a flyer file");

    setBusy(true);
    try {
      setStage("Creating batch…");
      const ext = file.name.split(".").pop() || "bin";
      const { data: batch, error: batchErr } = await supabase
        .from("flyer_extraction_batches")
        .insert({
          store_id: null,
          admin_user_id: userId,
          original_filename: file.name,
          stored_file_url: "pending",
          file_type: file.type,
          extraction_status: "pending",
          requires_confirmation: true,
        } as any)
        .select("id")
        .single();
      if (batchErr || !batch) throw new Error(batchErr?.message ?? "Could not create batch");

      setStage("Uploading flyer…");
      const path = `${batch.id}/flyer.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("flyer-uploads")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw new Error(upErr.message);
      await supabase.from("flyer_extraction_batches").update({ stored_file_url: path }).eq("id", batch.id);

      setStage("Extracting deals + store + dates with AI…");
      const { data, error } = await supabase.functions.invoke("extract-flyer-deals", {
        body: { batch_id: batch.id },
      });
      if (error) throw new Error(error.message);
      const extracted = (data as any)?.extracted ?? 0;

      toast.success(`Extracted ${extracted} deal${extracted === 1 ? "" : "s"}. Confirm details next.`);
      setOpen(false);
      reset();
      onComplete?.();
      setConfirmBatchId(batch.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <>
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
              Just drop the file (PDF/JPG/PNG, ≤20MB). AI will pull every deal plus the store and validity dates — you confirm details in the next step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
            <Button onClick={submit} disabled={busy || !file}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Upload className="h-3 w-3 mr-1.5" />}
              Extract deals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminFlyerConfirmDialog
        batchId={confirmBatchId}
        open={!!confirmBatchId}
        onOpenChange={(v) => { if (!v) setConfirmBatchId(null); }}
        onConfirmed={onComplete}
      />
    </>
  );
}
