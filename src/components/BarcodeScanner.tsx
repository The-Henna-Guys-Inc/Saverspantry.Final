import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ScanLine, Camera, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (result: { code: string; productName?: string; brand?: string; quantity?: string; categories?: string; imageUrl?: string }) => void;
};

export const BarcodeScanner = ({ open, onOpenChange, onDetected }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "looking-up" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // List cameras when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // Prompt for permission first so device labels appear
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list);
        setDeviceId(list[0]?.deviceId);
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(e?.message ?? "Camera permission denied");
      }
    })();
  }, [open]);

  // Start scanning when device is selected
  useEffect(() => {
    if (!open || !deviceId || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    setStatus("starting");
    let cancelled = false;

    reader
      .decodeFromVideoDevice(deviceId, videoRef.current, async (result, _err, controls) => {
        if (cancelled) return;
        controlsRef.current = controls;
        setStatus("scanning");
        if (result) {
          const code = result.getText();
          controls.stop();
          setStatus("looking-up");
          try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
            const data = await res.json();
            if (data.status === 1 && data.product) {
              const p = data.product;
              onDetected({
                code,
                productName: p.product_name || p.generic_name || undefined,
                brand: p.brands || undefined,
                quantity: p.quantity || undefined,
                categories: p.categories || undefined,
                imageUrl: p.image_front_url || p.image_url || p.image_small_url || undefined,
              });
              toast.success(`Found: ${p.product_name || code}`);
            } else {
              onDetected({ code });
              toast.message(`Scanned ${code}`, { description: "Not in product database — fill name manually." });
            }
          } catch {
            onDetected({ code });
            toast.message(`Scanned ${code}`);
          }
          onOpenChange(false);
        }
      })
      .catch((e) => {
        setStatus("error");
        setErrorMsg(e?.message ?? "Failed to start camera");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, deviceId, onDetected, onOpenChange]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setStatus("idle");
      setErrorMsg("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[96vw] sm:w-full p-4 sm:p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-accent" /> Scan barcode
          </DialogTitle>
          <DialogDescription>
            Hold the barcode steady in front of your camera. UPC, EAN, and QR codes are supported.
          </DialogDescription>
        </DialogHeader>

        {status === "error" ? (
          <div className="p-6 rounded-xl bg-destructive/5 text-destructive text-sm">
            <div className="font-semibold mb-1">Camera error</div>
            <div className="text-muted-foreground">{errorMsg}</div>
            <div className="text-xs mt-2 text-muted-foreground">
              On macOS Safari/Chrome, allow camera access for this site in browser settings.
            </div>
          </div>
        ) : (
          <>
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video w-full">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[88%] h-[28%] sm:w-3/4 sm:h-1/3 border-2 border-accent/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              {(status === "starting" || status === "looking-up") && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {status === "starting" ? "Starting camera…" : "Looking up product…"}
                </div>
              )}
            </div>

            {devices.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                <select
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const id = deviceId;
                    setDeviceId(undefined);
                    setTimeout(() => setDeviceId(id), 50);
                  }}
                  title="Restart"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
