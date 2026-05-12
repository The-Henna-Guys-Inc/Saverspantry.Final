import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Alias = {
  id: string;
  match_type: "from_address" | "from_domain";
  match_value: string;
  chain_name: string | null;
  store_id: string | null;
  notes: string | null;
};

const AdminEmailAliases = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [matchType, setMatchType] = useState<"from_address" | "from_domain">("from_domain");
  const [matchValue, setMatchValue] = useState("");
  const [chainName, setChainName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("store_email_aliases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setAliases((data ?? []) as Alias[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const add = async () => {
    if (!matchValue.trim()) return toast.error("Match value required");
    if (!chainName.trim() && !storeId.trim()) return toast.error("Set chain name or store id");
    setBusy(true);
    const { error } = await supabase.from("store_email_aliases").insert({
      match_type: matchType,
      match_value: matchValue.trim().toLowerCase(),
      chain_name: chainName.trim() || null,
      store_id: storeId.trim() || null,
      notes: notes.trim() || null,
      created_by: user!.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Alias added");
    setMatchValue(""); setChainName(""); setStoreId(""); setNotes("");
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this alias?")) return;
    const { error } = await supabase.from("store_email_aliases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAliases((p) => p.filter((a) => a.id !== id));
  };

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Email aliases</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/email-inbox">Email inbox</Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Map an inbound sender to a store chain or specific store. We try address first, then domain. ZIP in the email body narrows a chain to one location.
        </p>

        <Card className="p-4 rounded-2xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Match type</Label>
              <Select value={matchType} onValueChange={(v) => setMatchType(v as any)}>
                <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="from_domain">From domain (e.g. kroger.com)</SelectItem>
                  <SelectItem value="from_address">Exact from address</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Match value</Label>
              <Input value={matchValue} onChange={(e) => setMatchValue(e.target.value)}
                placeholder={matchType === "from_domain" ? "kroger.com" : "weeklyad@kroger.com"}
                className="rounded-xl mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Chain name (optional)</Label>
              <Input value={chainName} onChange={(e) => setChainName(e.target.value)} placeholder="Kroger" className="rounded-xl mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Specific store id (optional)</Label>
              <Input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="uuid" className="rounded-xl mt-1.5 font-mono text-xs" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl mt-1.5" />
            </div>
          </div>
          <Button onClick={add} disabled={busy} className="rounded-xl">
            {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Plus className="h-3 w-3 mr-1.5" />}
            Add alias
          </Button>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : aliases.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground rounded-3xl text-sm">
            No aliases yet. Add one above to start auto-routing emails to stores.
          </Card>
        ) : (
          <div className="space-y-2">
            {aliases.map((a) => (
              <Card key={a.id} className="p-3 rounded-2xl">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline">{a.match_type}</Badge>
                      <span className="font-mono text-sm break-all">{a.match_value}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      → {a.chain_name ? <>chain <strong>{a.chain_name}</strong></> : null}
                      {a.chain_name && a.store_id ? " · " : ""}
                      {a.store_id ? <>store <span className="font-mono">{a.store_id.slice(0, 8)}…</span></> : null}
                    </p>
                    {a.notes && <p className="text-xs italic text-muted-foreground mt-1">{a.notes}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminEmailAliases;
