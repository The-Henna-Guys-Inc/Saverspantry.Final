import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, LifeBuoy, Plus, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string;
  created_at: string;
};
type Msg = {
  id: string;
  body: string;
  sender_role: string;
  created_at: string;
};

const CATEGORIES = ["general", "bug", "billing", "account", "feature-request"];
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  awaiting_user: "Reply needed",
  resolved: "Resolved",
  closed: "Closed",
};

export const SupportTickets = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [view, setView] = useState<"list" | "new" | "thread">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, category, status, last_message_at, created_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  if (!user) return null;

  return (
    <Card className="mt-6 p-6 rounded-3xl border-border/50 shadow-soft">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest">
          <LifeBuoy className="h-3.5 w-3.5" /> Support
        </div>
        {view === "list" && (
          <Button size="sm" variant="hero" className="rounded-xl" onClick={() => setView("new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New ticket
          </Button>
        )}
        {view !== "list" && (
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { setView("list"); setActiveId(null); load(); }}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
        )}
      </div>

      {view === "list" && (
        loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tickets yet. Need help? Open one above.</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => { setActiveId(t.id); setView("thread"); }}
                  className="w-full text-left p-3 rounded-2xl border border-border/50 hover:bg-muted/40 transition-smooth"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{t.subject}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">{STATUS_LABEL[t.status] ?? t.status}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                    {t.category.replace("-", " ")} · {new Date(t.last_message_at).toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {view === "new" && (
        <NewTicketForm
          userId={user.id}
          onCreated={(id) => { setActiveId(id); setView("thread"); load(); }}
        />
      )}

      {view === "thread" && activeId && (
        <TicketThread ticketId={activeId} userId={user.id} isAdmin={false} />
      )}
    </Card>
  );
};

function NewTicketForm({ userId, onCreated }: { userId: string; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !body.trim()) return toast.error("Add a subject and message");
    setSubmitting(true);
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: userId, subject: subject.trim().slice(0, 200), category })
      .select("id").single();
    if (error || !t) { setSubmitting(false); return toast.error(error?.message ?? "Could not create"); }
    const { error: mErr } = await supabase
      .from("support_ticket_messages")
      .insert({ ticket_id: t.id, sender_user_id: userId, sender_role: "user", body: body.trim().slice(0, 5000) });
    setSubmitting(false);
    if (mErr) return toast.error(mErr.message);
    toast.success("Ticket submitted");
    onCreated(t.id);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="rounded-xl mt-1" />
      </div>
      <div>
        <Label className="text-xs">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace("-", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">How can we help?</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000}
          className="rounded-xl mt-1 min-h-[120px]" placeholder="Describe what's happening — include any steps that led to it." />
      </div>
      <Button variant="hero" className="rounded-xl" disabled={submitting} onClick={submit}>
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Submit ticket
      </Button>
    </div>
  );
}

export function TicketThread({
  ticketId, userId, isAdmin,
}: { ticketId: string; userId: string; isAdmin: boolean }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from("support_tickets").select("id, subject, category, status, last_message_at, created_at").eq("id", ticketId).maybeSingle(),
      supabase.from("support_ticket_messages").select("id, body, sender_role, created_at").eq("ticket_id", ticketId).order("created_at"),
    ]);
    setTicket(t as Ticket | null);
    setMsgs((m ?? []) as Msg[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [ticketId]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketId,
      sender_user_id: userId,
      sender_role: isAdmin ? "admin" : "user",
      body: reply.trim().slice(0, 5000),
      internal_note: isAdmin ? internal : false,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setReply("");
    setInternal(false);
    load();
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!ticket) return <p className="text-sm text-muted-foreground">Ticket not found.</p>;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold">{ticket.subject}</h3>
          <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[ticket.status] ?? ticket.status}</Badge>
        </div>
        <div className="text-[11px] text-muted-foreground capitalize">{ticket.category.replace("-", " ")}</div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {msgs.map((m) => (
          <div key={m.id} className={`p-3 rounded-2xl text-sm ${
            m.sender_role === "admin"
              ? "bg-primary/10 border border-primary/20"
              : "bg-muted/50"
          }`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {m.sender_role === "admin" ? "Support" : "You"} · {new Date(m.created_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && (
        <div className="space-y-2">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000}
            className="rounded-xl min-h-[90px]" placeholder="Type a reply…" />
          {isAdmin && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Internal note (hidden from user)
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="hero" className="rounded-xl" disabled={sending} onClick={send}>
              {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send reply
            </Button>
            {isAdmin && (
              <>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setStatus("resolved")}>Mark resolved</Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setStatus("closed")}>Close</Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setStatus("open")}>Reopen</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
