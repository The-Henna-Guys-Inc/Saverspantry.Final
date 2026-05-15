import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ShieldCheck, RefreshCw, Inbox, ExternalLink, Send, Paperclip, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Ingestion = {
  id: string;
  from_address: string;
  from_domain: string;
  subject: string | null;
  received_at: string;
  matched_store_id: string | null;
  match_confidence: string;
  match_method: string | null;
  detected_zip: string | null;
  detected_address: string | null;
  status: string;
  attachment_count: number;
  body_text_excerpt: string | null;
  notes: string | null;
};

type Store = { id: string; name: string; chain_name: string | null; city: string | null; region: string | null };

const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
  if (s === "processed") return "default";
  if (s === "needs_assignment") return "destructive";
  if (s === "failed") return "destructive";
  return "secondary";
};

const confidenceVariant = (c: string): "default" | "secondary" | "outline" | "destructive" => {
  if (c === "high") return "default";
  if (c === "low") return "secondary";
  return "destructive";
};

const AdminEmailInbox = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Ingestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ingestion | null>(null);
  const [batches, setBatches] = useState<Array<{ id: string; extracted_items_count: number; extraction_status: string; original_filename: string }>>([]);
  const [storeQuery, setStoreQuery] = useState("");
  const [storeResults, setStoreResults] = useState<Store[]>([]);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();

      if (cancelled) return;
      setIsAdmin(!!data);
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promo_email_ingestions")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setItems((data ?? []) as Ingestion[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  useEffect(() => {
    if (!selected) { setBatches([]); return; }
    (async () => {
      const { data } = await supabase
        .from("flyer_extraction_batches")
        .select("id, extracted_items_count, extraction_status, original_filename")
        .eq("source_email_id", selected.id)
        .order("created_at", { ascending: false });
      setBatches((data ?? []) as any);
    })();
  }, [selected]);

  useEffect(() => {
    if (!storeQuery.trim()) { setStoreResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("specialty_stores")
        .select("id, name, chain_name, city, region")
        .ilike("name", `%${storeQuery.trim()}%`)
        .eq("active", true)
        .limit(8);
      setStoreResults((data ?? []) as Store[]);
    }, 200);
    return () => clearTimeout(t);
  }, [storeQuery]);

  const reassign = async (storeId: string) => {
    if (!selected) return;
    setReassigning(true);
    const { error } = await supabase
      .from("promo_email_ingestions")
      .update({ matched_store_id: storeId, match_confidence: "high", match_method: "admin_override", status: "received" })
      .eq("id", selected.id);
    setReassigning(false);
    if (error) return toast.error(error.message);
    toast.success("Store reassigned. Hit reprocess to extract deals.");
    load();
    setSelected(null);
  };

  const reprocess = async () => {
    if (!selected?.matched_store_id) {
      toast.error("Assign a store first");
      return;
    }
    toast.info("Reprocessing isn't wired up yet — coming next. For now, re-forward the email or use Upload flyer with the matched store.");
  };

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Email inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} className="rounded-xl">
              <RefreshCw className="h-3 w-3 mr-1.5" /> Refresh
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/email-aliases">Aliases</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/deals">Moderation</Link>
            </Button>
          </div>
        </div>

        <Card className="p-4 rounded-2xl bg-muted/40">
          <div className="flex items-start gap-3">
            <Inbox className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Forward grocery promo emails to <code className="font-mono text-primary">deals@yourdomain</code> to ingest them.</p>
              <p className="text-muted-foreground">Each email becomes a row here. PDFs and images are auto-fed into the AI extractor; results land in the moderation queue.</p>
            </div>
          </div>
        </Card>

        <ManualIngestCard onIngested={load} />

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground rounded-3xl">
            No emails yet. Once Resend Inbound is wired up, forwarded promo emails will appear here.
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <Card key={it.id} className="p-3 rounded-2xl cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setSelected(it)}>
                <div className="flex items-start gap-3 flex-wrap">
                  <Mail className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={statusVariant(it.status)}>{it.status.replace("_", " ")}</Badge>
                      <Badge variant={confidenceVariant(it.match_confidence)}>match: {it.match_confidence}</Badge>
                      {it.attachment_count > 0 && <Badge variant="outline">{it.attachment_count} attachment{it.attachment_count === 1 ? "" : "s"}</Badge>}
                    </div>
                    <p className="font-medium truncate">{it.subject || "(no subject)"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      from <span className="font-mono">{it.from_address}</span> · {formatDistanceToNow(new Date(it.received_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selected && (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">{selected.subject || "(no subject)"}</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">From</p>
                    <p className="font-mono break-all">{selected.from_address}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={statusVariant(selected.status)}>{selected.status.replace("_", " ")}</Badge>
                    <Badge variant={confidenceVariant(selected.match_confidence)}>{selected.match_confidence}</Badge>
                    {selected.match_method && <Badge variant="outline">via {selected.match_method}</Badge>}
                  </div>
                  {(selected.detected_zip || selected.detected_address) && (
                    <div className="text-xs text-muted-foreground">
                      {selected.detected_zip && <p>ZIP detected: <span className="font-mono">{selected.detected_zip}</span></p>}
                      {selected.detected_address && <p>Address: {selected.detected_address}</p>}
                    </div>
                  )}
                  {selected.notes && <p className="text-xs italic text-muted-foreground">{selected.notes}</p>}
                  {selected.body_text_excerpt && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Body excerpt</p>
                      <p className="text-xs whitespace-pre-wrap line-clamp-6 bg-muted/40 p-2 rounded-lg">{selected.body_text_excerpt}</p>
                    </div>
                  )}

                  <div className="border-t border-border pt-3">
                    <Label className="text-xs">Reassign store</Label>
                    <Input
                      value={storeQuery}
                      onChange={(e) => setStoreQuery(e.target.value)}
                      placeholder="Search store name…"
                      className="mt-1.5 rounded-xl"
                    />
                    {storeResults.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {storeResults.map((s) => (
                          <button
                            key={s.id}
                            disabled={reassigning}
                            onClick={() => reassign(s.id)}
                            className="w-full text-left p-2 rounded-lg hover:bg-muted text-xs"
                          >
                            <p className="font-medium">{s.name}</p>
                            <p className="text-muted-foreground">
                              {s.chain_name ? `${s.chain_name} · ` : ""}{s.city}{s.region ? `, ${s.region}` : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Extraction batches</p>
                    {batches.length === 0 ? (
                      <p className="text-xs italic text-muted-foreground">No batches yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {batches.map((b) => (
                          <Link
                            key={b.id}
                            to={`/admin/deals?batch=${b.id}`}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted text-xs"
                          >
                            <span className="truncate">{b.original_filename}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px]">{b.extraction_status}</Badge>
                              <span className="text-muted-foreground">{b.extracted_items_count} items</span>
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button onClick={reprocess} variant="outline" size="sm" className="w-full rounded-xl">
                    Reprocess
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
};

export default AdminEmailInbox;
