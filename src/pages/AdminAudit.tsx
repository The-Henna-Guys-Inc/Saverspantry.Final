import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Entry = {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: any;
  ip_address: string | null;
  created_at: string;
};

const AdminAudit = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

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
    let q = supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300);
    if (filter) q = q.ilike("action", `%${filter}%`);
    const { data } = await q;
    setRows((data ?? []) as Entry[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (authLoading || checking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Admin audit log</h1>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Filter by action…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-64" />
            <Button size="sm" onClick={load}>Filter</Button>
          </div>
        </div>

        <Card className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono">{r.action}</Badge></TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {r.target_type ? `${r.target_type}:${(r.target_id ?? "").slice(0, 8)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {r.admin_user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md">
                      <pre className="text-[10px] truncate">{JSON.stringify(r.metadata)}</pre>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No entries.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminAudit;
