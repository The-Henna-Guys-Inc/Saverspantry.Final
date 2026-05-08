import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Loader2, Camera, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onDate: (iso: string) => void;
}

// Compress to ~1024px JPEG to keep payloads small
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
  const max = 1024;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

export const ExpiryDateScanner = ({ onDate }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ date_iso: string | null; raw_text?: string | null; confidence?: string } | null>(null);

  const reset = () => { setPreview(null); setResult(null); };

  const handleFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const b64 = await fileToCompressedBase64(file);
      setPreview(b64);
      const { data, error } = await supabase.functions.invoke("expiry-date-ocr", { body: { imageBase64: b64 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      if (!data?.date_iso) toast.error("Couldn't read a date — try a closer, sharper photo.");
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const useDate = () => {
    if (result?.date_iso) {
      onDate(result.date_iso);
      toast.success(`Expiry set to ${result.date_iso}`);
      setOpen(false);
      reset();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl h-10 px-3"
        onClick={() => { reset(); setOpen(true); setTimeout(() => inputRef.current?.click(), 50); }}
      >
        <Camera className="h-4 w-4 mr-1.5" />
        Scan date
      </Button>

      <input
        ref={inputRef}
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
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Calendar className="h-5 w-5" /> Scan expiry date
            </DialogTitle>
            <DialogDescription>
              Aim at the printed EXP / BB / USE BY date. Hold steady — closer is better.
            </DialogDescription>
          </DialogHeader>

          {busy && (
            <div className="flex flex-col items-center py-6 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Reading the date…
            </div>
          )}

          {preview && !busy && (
            <div className="space-y-3">
              <img src={preview} alt="Scanned label" className="w-full rounded-xl border border-border max-h-64 object-contain bg-muted" />
              {result?.date_iso ? (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wider text-accent mb-1">Detected expiry</div>
                  <div className="text-lg font-bold text-primary">{result.date_iso}</div>
                  {result.raw_text && <div className="text-xs text-muted-foreground mt-1">From label: "{result.raw_text}"</div>}
                  {result.confidence && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Confidence: {result.confidence}</div>}
                </div>
              ) : (
                <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-sm text-destructive">
                  No date found. Try a closer photo with good lighting.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            {preview && !busy && (
              <Button variant="outline" className="rounded-xl" onClick={() => { reset(); inputRef.current?.click(); }}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Retake
              </Button>
            )}
            {result?.date_iso && (
              <Button variant="hero" className="rounded-xl" onClick={useDate}>Use this date</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
