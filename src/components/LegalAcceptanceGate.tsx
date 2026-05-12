import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Markdown } from "./Markdown";
import { Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";

type LegalDoc = {
  id: string;
  doc_type: "tos" | "privacy";
  version: number;
  title: string;
  content_md: string;
};

export const LegalAcceptanceGate = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!user) { setPending([]); return; }
    (async () => {
      const [{ data: docs }, { data: accepts }] = await Promise.all([
        supabase.from("legal_documents").select("id, doc_type, version, title, content_md").eq("is_active", true),
        supabase.from("user_legal_acceptances").select("document_id").eq("user_id", user.id),
      ]);
      const accepted = new Set((accepts ?? []).map((a) => a.document_id));
      setPending(((docs ?? []) as LegalDoc[]).filter((d) => !accepted.has(d.id)));
    })();
  }, [user]);

  if (!user || pending.length === 0) return null;

  const acceptAll = async () => {
    setAccepting(true);
    try {
      const ua = navigator.userAgent;
      const rows = pending.map((d) => ({
        user_id: user.id, document_id: d.id, doc_type: d.doc_type,
        version: d.version, user_agent: ua,
      }));
      const { error } = await supabase
        .from("user_legal_acceptances")
        .upsert(rows, { onConflict: "user_id,document_id", ignoreDuplicates: true });
      if (error) throw error;
      setPending([]);
      toast.success("Thanks — you're all set.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not record acceptance");
    } finally {
      setAccepting(false);
    }
  };

  const isUpdate = pending.some((d) => d.version > 1);

  return (
    <Dialog open={pending.length > 0}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest">
            <ScrollText className="h-3.5 w-3.5" /> {isUpdate ? "Updated" : ""} Legal terms
          </div>
          <DialogTitle className="text-xl">
            {isUpdate ? "We've updated our terms" : "Please review and accept"}
          </DialogTitle>
          <DialogDescription>
            Take a moment to review the {pending.map((d) => d.title).join(" and ")}. You'll need to accept to keep using Saver's Pantry.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {pending.map((d) => (
            <Card key={d.id} className="p-5 rounded-2xl border-border/50">
              <Markdown content={d.content_md} />
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
          <Button variant="hero" onClick={acceptAll} disabled={accepting} className="rounded-xl">
            {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            I accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
