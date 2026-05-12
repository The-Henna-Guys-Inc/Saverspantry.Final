import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tp_pwa_dismissed_at";

export const InstallPrompt = () => {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    setShow(false);
  };

  if (!show || !evt) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 rounded-2xl bg-card border border-border/60 shadow-elegant p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-leaf flex items-center justify-center shrink-0">
        <Download className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-primary">Install Saver's Pantry</div>
        <div className="text-xs text-muted-foreground mt-0.5">Add to your home screen for quick access.</div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="hero" className="rounded-xl h-8 text-xs" onClick={install}>Install</Button>
          <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs" onClick={dismiss}>Not now</Button>
        </div>
      </div>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
