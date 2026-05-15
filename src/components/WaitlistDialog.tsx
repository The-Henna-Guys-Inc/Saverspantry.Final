import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sprout } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  trigger: ReactNode;
  source?: string; // 'deals_page' | 'landing_footer' | etc.
  defaultZip?: string | null;
};

export function WaitlistDialog({ trigger, source = "deals_page", defaultZip }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState(defaultZip ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const submit = async () => {
    if (!city.trim() || !state.trim()) {
      toast.error("Please share your city and state");
      return;
    }
    const finalEmail = (email || user?.email || "").trim();
    if (!finalEmail || !/^\S+@\S+\.\S+$/.test(finalEmail)) {
      toast.error("Please enter a valid email");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("city_waitlist").insert({
      user_id: user?.id ?? null,
      email: finalEmail,
      city: city.trim().slice(0, 80),
      state: state.trim().slice(0, 40),
      zip_code: zip.trim() ? zip.trim().slice(0, 10) : null,
      source,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("You're on the list — we'll email you when we launch in your area.");
    setCity(""); setState(""); setZip(""); 
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Sprout className="h-5 w-5" /> Bring Saver's Pantry to your city
          </DialogTitle>
          <DialogDescription>
            Tell us where you are and we'll let you know the moment we launch nearby.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wl-city" className="text-xs">City</Label>
              <Input id="wl-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-state" className="text-xs">State</Label>
              <Input id="wl-state" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wl-zip" className="text-xs">ZIP code <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="wl-zip" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="78701" inputMode="numeric" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wl-email" className="text-xs">Email</Label>
            <Input id="wl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl" disabled={!!user?.email} />
            {user?.email && <p className="text-[11px] text-muted-foreground">Using your account email.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="rounded-xl">
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Notify me
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
