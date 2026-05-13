import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ScanLine, Camera, Zap, ZapOff } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import {
  BarcodeScanner as MLKitScanner,
  BarcodeFormat as MLKitFormat,
} from "@capacitor-mlkit/barcode-scanning";

const isNative = Capacitor.isNativePlatform();

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

// Lookup product details from Open Food Facts
async function lookupProduct(code: string) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      return {
        code,
        productName: p.product_name || p.generic_name || undefined,
        brand: p.brands || undefined,
        quantity: p.quantity || undefined,
        categories: p.categories || undefined,
        imageUrl: p.image_front_url || p.image_url || p.image_small_url || undefined,
      };
    }
  } catch { /* ignore */ }
  return { code };
}

export const BarcodeScanner = ({ open, onOpenChange, onDetected, mode = "add" }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nativeRafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const onOpenChangeRef = useRef(onOpenChange);
  onDetectedRef.current = onDetected;
  onOpenChangeRef.current = onOpenChange;

  const [status, setStatus] = useState<"needs-permission" | "requesting" | "scanning" | "looking-up" | "error">("needs-permission");
  const [errorMsg, setErrorMsg] = useState("");
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stopAll = () => {
    stoppedRef.current = true;
    try { controlsRef.current?.stop(); } catch { /* */ }
    controlsRef.current = null;
    if (nativeRafRef.current != null) {
      cancelAnimationFrame(nativeRafRef.current);
      nativeRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* */ } });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch { /* */ }
    }
  };

  // Prime AudioContext on open.
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

  useEffect(() => {
    if (!open) {
      stopAll();
      setStatus("needs-permission");
      setErrorMsg("");
      setPermanentlyDenied(false);
      setTorchOn(false);
      setTorchSupported(false);
      return;
    }
    stoppedRef.current = false;

    // Native (iOS/Android via Capacitor) — use ML Kit, skip the web video element entirely.
    if (isNative) {
      (async () => {
        try {
          const { camera } = await MLKitScanner.requestPermissions();
          if (camera !== "granted" && camera !== "limited") {
            setPermanentlyDenied(true);
            setErrorMsg("Camera permission denied. Enable it in Settings → Saver's Pantry → Camera.");
            setStatus("error");
            return;
          }
          // Android needs the Google Barcode Scanner Module to be installed once.
          if (Capacitor.getPlatform() === "android") {
            try {
              const { available } = await MLKitScanner.isGoogleBarcodeScannerModuleAvailable();
              if (!available) await MLKitScanner.installGoogleBarcodeScannerModule();
            } catch { /* best-effort */ }
          }
          setStatus("scanning");
          const { barcodes } = await MLKitScanner.scan({
            formats: [
              MLKitFormat.Ean13, MLKitFormat.Ean8, MLKitFormat.UpcA, MLKitFormat.UpcE,
              MLKitFormat.Code128, MLKitFormat.Code39, MLKitFormat.Itf, MLKitFormat.QrCode,
            ],
          });
          const code = barcodes?.[0]?.rawValue;
          if (code) {
            await handleDetected(code);
          } else {
            onOpenChangeRef.current(false);
          }
        } catch (e: any) {
          console.error("[scanner] native scan failed:", e);
          setErrorMsg(e?.message ?? "Native scanner failed.");
          setStatus("error");
        }
      })();
      return;
    }

    (async () => {
      try {
        // @ts-ignore
        const perm: PermissionStatus | undefined = await navigator.permissions?.query({ name: "camera" as PermissionName });
        if (perm?.state === "denied") setPermanentlyDenied(true);
      } catch { /* */ }
    })();
  }, [open]);

  const handleDetected = async (code: string) => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    try { controlsRef.current?.stop(); } catch { /* */ }
    if (nativeRafRef.current != null) cancelAnimationFrame(nativeRafRef.current);
    playBeep(audioCtxRef.current);
    setStatus("looking-up");
    const result = await lookupProduct(code);
    onDetectedRef.current(result);
    if (result.productName) toast.success(`Found: ${result.productName}`);
    else toast.message(`Scanned ${code}`, { description: "Not in product database — fill name manually." });
    onOpenChangeRef.current(false);
  };

  const requestCamera = async () => {
    setStatus("requesting");
    setErrorMsg("");
    stoppedRef.current = false;

    if (isNative) {
      try {
        setStatus("scanning");
        const { barcodes } = await MLKitScanner.scan({
          formats: [
            MLKitFormat.Ean13, MLKitFormat.Ean8, MLKitFormat.UpcA, MLKitFormat.UpcE,
            MLKitFormat.Code128, MLKitFormat.Code39, MLKitFormat.Itf, MLKitFormat.QrCode,
          ],
        });
        const code = barcodes?.[0]?.rawValue;
        if (code) await handleDetected(code);
        else onOpenChangeRef.current(false);
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Native scanner failed.");
        setStatus("error");
      }
      return;
    }

    let stream: MediaStream;
    try {
      // High-resolution constraints help dramatically with small/dense barcodes on iPhone.
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // @ts-ignore — non-standard but iOS Safari respects these
          focusMode: "continuous",
          // @ts-ignore
          advanced: [{ focusMode: "continuous" }, { focusMode: "auto" }],
        },
        audio: false,
      });
    } catch (e: any) {
      console.error("[scanner] getUserMedia failed:", e?.name, e?.message);
      // Retry with looser constraints if iOS rejected the advanced ones
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e2: any) {
        const name = e2?.name as string | undefined;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setPermanentlyDenied(true);
          setErrorMsg("Camera permission was blocked by the browser.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setErrorMsg("No camera was found on this device.");
        } else if (name === "NotReadableError") {
          setErrorMsg("Camera is in use by another app. Close it and try again.");
        } else {
          setErrorMsg(e2?.message ?? "Could not start the camera.");
        }
        setStatus("error");
        return;
      }
    }

    streamRef.current = stream;
    setStatus("scanning");

    // Probe torch support
    try {
      const track = stream.getVideoTracks()[0];
      const caps: any = track.getCapabilities?.() || {};
      if (caps.torch) setTorchSupported(true);
    } catch { /* */ }

    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const video = videoRef.current;
    if (!video) {
      stopAll();
      setErrorMsg("Scanner failed to initialize.");
      setStatus("error");
      return;
    }

    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    try { await video.play(); } catch (e) { console.warn("[scanner] video.play() warn:", e); }

    // 1) Prefer the native BarcodeDetector — it's *much* faster than ZXing on iOS 17+ Safari and Android Chrome.
    const NativeDetector = (window as any).BarcodeDetector;
    if (NativeDetector) {
      try {
        const supported: string[] = (await NativeDetector.getSupportedFormats?.()) || [];
        const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"]
          .filter((f) => supported.length === 0 || supported.includes(f));
        const detector = new NativeDetector({ formats });
        const tick = async () => {
          if (stoppedRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0) {
              const code = codes[0].rawValue || codes[0].rawValue?.toString?.() || "";
              if (code) {
                await handleDetected(code);
                return;
              }
            }
          } catch { /* keep trying */ }
          nativeRafRef.current = requestAnimationFrame(tick);
        };
        nativeRafRef.current = requestAnimationFrame(tick);
        return;
      } catch (e) {
        console.warn("[scanner] BarcodeDetector failed, falling back to ZXing:", e);
      }
    }

    // 2) ZXing fallback with TRY_HARDER + restricted formats for speed.
    try {
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
      ]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
      const controls = await reader.decodeFromVideoElement(video, async (result) => {
        if (!result) return;
        await handleDetected(result.getText());
      });
      controlsRef.current = controls;
    } catch (e: any) {
      console.error("[scanner] zxing failed:", e);
      stopAll();
      setErrorMsg(e?.message ?? "Failed to start the barcode reader.");
      setStatus("error");
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      // @ts-ignore — torch is non-standard but supported on most mobile browsers
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) {
      console.warn("[scanner] torch toggle failed:", e);
      toast.message("Flashlight not available on this device");
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
              : "Hold the barcode steady, fill the box, and tap the flashlight if it's dim."}
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
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm active:scale-95 transition"
                aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
              >
                {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
              </button>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/90 text-xs bg-black/50 rounded-full px-3 py-1 backdrop-blur-sm">
              Fill the box with the barcode • hold ~10cm away
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
