import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ScanLine, Camera } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (result: { code: string; productName?: string; brand?: string; quantity?: string; categories?: string; imageUrl?: string }) => void;
  mode?: "add" | "remove";
};

function playBeep(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const make = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g).connect(ctx.destination);
      g.gain.exponentialRampToValueAtTime(0.35, now + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.start(now + start);
      o.stop(now + start + dur + 0.02);
    };
    make(1320, 0, 0.18);
    make(1760, 0.12, 0.18);
  } catch {
    /* ignore */
  }
}

export const BarcodeScanner = ({ open, onOpenChange, onDetected, mode = "add" }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onOpenChangeRef = useRef(onOpenChange);
  onDetectedRef.current = onDetected;
  onOpenChangeRef.current = onOpenChange;

  const [status, setStatus] = useState<"needs-permission" | "requesting" | "scanning" | "looking-up" | "error">("needs-permission");
  const [errorMsg, setErrorMsg] = useState("");
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);

  const stopAll = () => {
    try { controlsRef.current?.stop(); } catch { /* */ }
    controlsRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* */ } });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch { /* */ }
    }
  };

  // Prime AudioContext on open (user just tapped Scan).
  useEffect(() => {
    if (!open) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch { /* */ }
  }, [open]);

  // Cleanup on close + reset state.
  useEffect(() => {
    if (!open) {
      stopAll();
      setStatus("needs-permission");
      setErrorMsg("");
      setPermanentlyDenied(false);
      return;
    }
    // On open, peek at permission state — but DON'T auto-call getUserMedia
    // (Chrome can refuse if not in a user-gesture even when granted).
    (async () => {
      try {
        // @ts-ignore
        const perm: PermissionStatus | undefined = await navigator.permissions?.query({ name: "camera" as PermissionName });
        if (perm?.state === "denied") setPermanentlyDenied(true);
      } catch { /* permissions API unavailable */ }
    })();
  }, [open]);

  // The critical path: called directly from the user's click.
  // Do getUserMedia FIRST (synchronously inside the gesture), then everything else.
  const requestCamera = async () => {
    setStatus("requesting");
    setErrorMsg("");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch (e: any) {
      console.error("[scanner] getUserMedia failed:", e?.name, e?.message);
      const name = e?.name as string | undefined;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermanentlyDenied(true);
        setErrorMsg("Camera permission was blocked by the browser.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setErrorMsg("No camera was found on this device.");
      } else if (name === "NotReadableError") {
        setErrorMsg("Camera is in use by another app. Close it and try again.");
      } else {
        setErrorMsg(e?.message ?? "Could not start the camera.");
      }
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    setStatus("scanning");

    // Wait one frame for the <video> element to mount in the new state.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const video = videoRef.current;
    if (!video) {
      console.error("[scanner] video element missing after mount");
      stopAll();
      setErrorMsg("Scanner failed to initialize.");
      setStatus("error");
      return;
    }

    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    try { await video.play(); } catch (e) { console.warn("[scanner] video.play() warn:", e); }

    // Hand the already-running video to zxing — no second getUserMedia.
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoElement(video, async (result) => {
        if (!result) return;
        const code = result.getText();
        try { controls.stop(); } catch { /* */ }
        playBeep(audioCtxRef.current);
        setStatus("looking-up");
        try {
          const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
          const data = await res.json();
          if (data.status === 1 && data.product) {
            const p = data.product;
            onDetectedRef.current({
              code,
              productName: p.product_name || p.generic_name || undefined,
              brand: p.brands || undefined,
              quantity: p.quantity || undefined,
              categories: p.categories || undefined,
              imageUrl: p.image_front_url || p.image_url || p.image_small_url || undefined,
            });
            toast.success(`Found: ${p.product_name || code}`);
          } else {
            onDetectedRef.current({ code });
            toast.message(`Scanned ${code}`, { description: "Not in product database — fill name manually." });
          }
        } catch {
          onDetectedRef.current({ code });
          toast.message(`Scanned ${code}`);
        }
        onOpenChangeRef.current(false);
      });
      controlsRef.current = controls;
    } catch (e: any) {
      console.error("[scanner] zxing failed:", e);
      stopAll();
      setErrorMsg(e?.message ?? "Failed to start the barcode reader.");
      setStatus("error");
    }
  };

  const showVideo = status === "scanning" || status === "looking-up";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[96vw] sm:w-full p-4 sm:p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-accent" /> {mode === "remove" ? "Scan to remove" : "Scan to add"}
          </DialogTitle>
          <DialogDescription>
            {mode === "remove"
              ? "Scan the barcode of an item you're using up — we'll deduct one from your pantry."
              : "Hold the barcode steady — we'll fetch the product details for you."}
          </DialogDescription>
        </DialogHeader>

        {(status === "needs-permission" || status === "requesting") && (
          <div className="p-6 rounded-xl bg-secondary/40 text-center space-y-3">
            <Camera className="h-8 w-8 mx-auto text-accent" />
            <div className="text-sm text-foreground font-medium">Camera access needed</div>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Tap below — your browser will ask for camera permission. We only use it while this scanner is open.
            </p>
            <Button onClick={requestCamera} disabled={status === "requesting"} variant="hero" size="sm" className="rounded-xl">
              {status === "requesting" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /><span className="ml-2">Starting…</span></>
              ) : (
                <><Camera className="h-4 w-4" /><span className="ml-2">Allow camera</span></>
              )}
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="p-6 rounded-xl bg-destructive/5 text-sm space-y-3">
            <div>
              <div className="font-semibold mb-1 text-destructive">Camera unavailable</div>
              <div className="text-muted-foreground">{errorMsg}</div>
            </div>
            {permanentlyDenied && (
              <div className="text-xs text-muted-foreground">
                Your browser is blocking camera access. Tap the camera/lock icon in the address bar, set Camera to <strong>Allow</strong>, then try again.
              </div>
            )}
            <Button onClick={requestCamera} variant="hero" size="sm" className="rounded-xl">
              <Camera className="h-4 w-4" /><span className="ml-2">Try again</span>
            </Button>
          </div>
        )}

        {showVideo && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video w-full">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[88%] h-[28%] sm:w-3/4 sm:h-1/3 border-2 border-accent/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {status === "looking-up" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Looking up product…
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
