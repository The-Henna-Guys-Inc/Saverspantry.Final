
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, last_message_at DESC);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status, last_message_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user',
  body TEXT NOT NULL,
  internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_ticket_messages_ticket ON public.support_ticket_messages(ticket_id, created_at);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Users see non-internal messages on tickets they own
CREATE POLICY "Users view own ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    NOT internal_note
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Users insert own ticket messages" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND sender_role = 'user'
    AND internal_note = false
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admins view all ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert ticket messages" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND auth.uid() = sender_user_id);

-- Trigger: bump ticket last_message_at + reopen if user replies / awaiting_user if admin replies
CREATE OR REPLACE FUNCTION public.bump_support_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.internal_note THEN
    UPDATE public.support_tickets SET last_message_at = NEW.created_at WHERE id = NEW.ticket_id;
  ELSIF NEW.sender_role = 'admin' THEN
    UPDATE public.support_tickets
      SET last_message_at = NEW.created_at,
          status = CASE WHEN status IN ('open','awaiting_user') THEN 'awaiting_user' ELSE status END
      WHERE id = NEW.ticket_id;
  ELSE
    UPDATE public.support_tickets
      SET last_message_at = NEW.created_at,
          status = CASE WHEN status IN ('resolved','closed') THEN 'open' WHEN status = 'awaiting_user' THEN 'open' ELSE status END
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_bump_support_ticket
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_support_ticket();
