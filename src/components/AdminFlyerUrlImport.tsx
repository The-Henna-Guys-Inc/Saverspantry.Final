import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminFlyerConfirmDialog } from "./AdminFlyerConfirmDialog";

export function AdminFlyerUrlImport({ onComplete }: { userId?: string; onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [confirmBatchId, setConfirmBatchId] = useState<string | null>(null);

  const submit = async () => {
    if (!url) return toast.error("Paste a flyer URL");
    setBusy(true);
    setStage("Fetching URL and extracting deals…");
    try {
      const { data, error } = await supabase.functions.invoke("import-flyer-from-url", {
        body: { url },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.error) throw new Error(d.error);

      const batchId = d?.batch_id ?? d?.extracted?.batch_id;
      if (!batchId) throw new Error("No batch returned");
      const count = d?.extracted?.extracted ?? d?.extracted ?? 0;
      toast.success(`Extracted ${count} deal${count === 1 ? "" : "s"}. Confirm details next.`);
      setOpen(false);
      setUrl("");
      setStage("");
      setConfirmBatchId(batchId);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setUrl(""); setStage(""); } }}>
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
              AI extracts the deals plus the store and validity dates — you confirm details in the next step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="url">Flyer URL</Label>
              <Input id="url" type="url" placeholder="https://…" value={url}
                onChange={(e) => setUrl(e.target.value)} disabled={busy} />
            </div>

            {stage && (
              <div className="text-xs text-primary flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> {stage}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !url}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
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
