import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Loader2, Users, MoreHorizontal, Shield } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  profile: { display_name: string | null; subscription_tier: string; deletion_pending_at: string | null } | null;
  roles: string[];
};

const AdminUsers = () => {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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
    const sess = (await supabase.auth.getSession()).data.session;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users-list?page=${page}&perPage=50&search=${encodeURIComponent(search)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${sess?.access_token}` } });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to load users");
      setLoading(false);
      return;
    }
    setUsers(json.users ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, page]);

  const action = async (target: AdminUser, action: string, extra: Record<string, unknown> = {}) => {
    toast.loading("Working…", { id: "uact" });
    const { data, error } = await supabase.functions.invoke("admin-user-action", {
      body: { action, target_user_id: target.id, ...extra },
    });
    if (error || (data as any)?.error) {
      toast.error(error?.message ?? (data as any).error, { id: "uact" });
      return;
    }
    toast.success("Done", { id: "uact" });
    load();
  };

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
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Users</h1>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Search email or id…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
            <Button size="sm" onClick={() => { setPage(1); load(); }}>Search</Button>
          </div>
        </div>

        <Card className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const banned = u.banned_until && new Date(u.banned_until) > new Date();
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div>{u.email ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.profile?.display_name ?? ""}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{u.profile?.subscription_tier ?? "free"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                            u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "outline"}>{r}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {banned ? <Badge variant="destructive">banned</Badge>
                          : !u.email_confirmed_at ? <Badge variant="outline">unverified</Badge>
                          : u.profile?.deletion_pending_at ? <Badge variant="destructive">pending delete</Badge>
                          : <Badge variant="secondary">active</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_sign_in_at ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true }) : "never"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => action(u, "send_password_reset")}>
                              Send password reset
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.roles.includes("admin")
                              ? <DropdownMenuItem onClick={() => action(u, "remove_role", { role: "admin" })}>Remove admin role</DropdownMenuItem>
                              : <DropdownMenuItem onClick={() => action(u, "add_role", { role: "admin" })}>Make admin</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            {banned
                              ? <DropdownMenuItem onClick={() => action(u, "unban")}>Unban user</DropdownMenuItem>
                              : <DropdownMenuItem className="text-destructive" onClick={() => action(u, "ban", { ban_duration: "8760h" })}>Ban user (1 year)</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {users.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No users.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>

        <div className="flex justify-between items-center">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>

        <Card className="p-4 flex items-start gap-3 bg-muted/30">
          <Shield className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            All actions are recorded in the admin audit log. You cannot ban or change your own admin role.
          </p>
        </Card>
      </main>
    </div>
  );
};

export default AdminUsers;
