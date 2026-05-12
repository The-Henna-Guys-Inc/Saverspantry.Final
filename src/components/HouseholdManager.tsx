import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Mail, Copy, LogOut, Trash2, Crown, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from "@/hooks/useHousehold";
import { useAuth } from "@/hooks/useAuth";

export const HouseholdManager = () => {
  const { user } = useAuth();
  const {
    loading, households, active, activeId, members, invites, isOwner,
    createHousehold, switchHousehold, renameHousehold, deleteHousehold,
    leaveHousehold, removeMember, createInvite, revokeInvite, redeemInvite,
  } = useHousehold();

  const [newName, setNewName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const onCreate = async () => {
    if (!newName.trim()) return toast.error("Name your household");
    setBusy("create");
    try { await createHousehold(newName); setNewName(""); toast.success("Household created"); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const onJoin = async () => {
    if (!joinCode.trim()) return toast.error("Enter an invite code");
    setBusy("join");
    try { await redeemInvite(joinCode); setJoinCode(""); toast.success("You're in!"); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const onInvite = async () => {
    if (!activeId) return;
    setBusy("invite");
    try { await createInvite(activeId, inviteEmail); setInviteEmail(""); toast.success("Invite created"); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const onRename = async () => {
    if (!active || !renameValue.trim()) return;
    setBusy("rename");
    try { await renameHousehold(active.id, renameValue); setRenameValue(""); toast.success("Renamed"); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const copyCode = async (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Invite link copied");
  };

  if (loading) {
    return (
      <Card className="p-6 rounded-3xl border-border/50 mt-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-3xl border-border/50 shadow-soft mt-6 space-y-5">
      <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest">
        <Users className="h-3.5 w-3.5" /> Household
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Share your pantry, watchlist, meal plan, and savings with anyone you cook with.
      </p>

      {households.length === 0 ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="hh-name" className="text-xs">Create a household</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="hh-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. The Smiths"
                className="rounded-xl"
              />
              <Button variant="hero" onClick={onCreate} disabled={busy === "create"} className="rounded-xl shrink-0">
                {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Create</span>
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50">
            <Label htmlFor="join" className="text-xs">Or join with an invite code</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="join"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC12345"
                className="rounded-xl font-mono uppercase"
              />
              <Button variant="outline" onClick={onJoin} disabled={busy === "join"} className="rounded-xl shrink-0">
                {busy === "join" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {households.length > 1 && (
            <div>
              <Label className="text-xs">Active household</Label>
              <Select value={activeId ?? undefined} onValueChange={switchHousehold}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {households.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {active && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-base font-semibold text-primary">{active.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {members.length} member{members.length === 1 ? "" : "s"}
                    {isOwner && " · You're the owner"}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex gap-2">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Rename..."
                      className="rounded-xl h-9 w-32"
                    />
                    <Button variant="outline" size="sm" onClick={onRename} disabled={busy === "rename" || !renameValue.trim()} className="rounded-xl">
                      Save
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-secondary/40">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-accent shrink-0" />}
                      <span className="truncate text-sm">
                        {m.display_name ?? "Member"}
                        {m.user_id === user?.id && <span className="text-muted-foreground"> (you)</span>}
                      </span>
                    </div>
                    {isOwner && m.role !== "owner" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.id)} title="Remove">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Invite */}
              <div className="pt-4 border-t border-border/50">
                <Label htmlFor="inv-email" className="text-xs">Invite someone</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="inv-email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email (optional, just for your records)"
                    className="rounded-xl"
                    type="email"
                  />
                  <Button variant="hero" onClick={onInvite} disabled={busy === "invite"} className="rounded-xl shrink-0">
                    {busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    <span className="ml-1.5 hidden sm:inline">Invite</span>
                  </Button>
                </div>
              </div>

              {invites.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending invites</div>
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl border border-border/50">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-semibold text-primary">{inv.code}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.invited_email ?? "Anyone with the link"} · expires {new Date(inv.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyCode(inv.code)} title="Copy link">
                        {copied === inv.code ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => revokeInvite(inv.id)} title="Revoke">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Join another / leave */}
              <div className="pt-4 border-t border-border/50 space-y-3">
                <div>
                  <Label htmlFor="join2" className="text-xs">Join another household with a code</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="join2"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="ABC12345"
                      className="rounded-xl font-mono uppercase"
                    />
                    <Button variant="outline" onClick={onJoin} disabled={busy === "join"} className="rounded-xl shrink-0">
                      {busy === "join" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {!isOwner && (
                    <Button variant="ghost" size="sm" onClick={() => leaveHousehold(active.id)} className="rounded-xl text-muted-foreground">
                      <LogOut className="h-3.5 w-3.5 mr-1.5" /> Leave household
                    </Button>
                  )}
                  {isOwner && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => {
                        if (confirm(`Delete "${active.name}"? This removes the household for everyone.`)) {
                          deleteHousehold(active.id).then(() => toast.success("Deleted")).catch((e) => toast.error(e.message));
                        }
                      }}
                      className="rounded-xl text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete household
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Always allow creating another */}
          <div className="pt-4 border-t border-border/50">
            <Label htmlFor="hh-name2" className="text-xs">Create another household</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="hh-name2"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Beach House"
                className="rounded-xl"
              />
              <Button variant="outline" onClick={onCreate} disabled={busy === "create"} className="rounded-xl shrink-0">
                {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
