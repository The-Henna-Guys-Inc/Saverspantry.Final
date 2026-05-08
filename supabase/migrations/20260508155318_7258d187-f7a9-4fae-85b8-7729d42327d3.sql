
-- Legal documents (versioned ToS, Privacy)
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type IN ('tos','privacy')),
  version integer NOT NULL,
  title text NOT NULL,
  content_md text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, version)
);
CREATE UNIQUE INDEX legal_documents_one_active ON public.legal_documents (doc_type) WHERE is_active;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated views legal_documents"
  ON public.legal_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert legal_documents"
  ON public.legal_documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update legal_documents"
  ON public.legal_documents FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete legal_documents"
  ON public.legal_documents FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- User acceptances
CREATE TABLE public.user_legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE (user_id, document_id)
);
CREATE INDEX idx_user_legal_acceptances_user ON public.user_legal_acceptances(user_id, doc_type);

ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own acceptances"
  ON public.user_legal_acceptances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own acceptances"
  ON public.user_legal_acceptances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all acceptances"
  ON public.user_legal_acceptances FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- Account deletion requests
CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_purge_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at timestamptz,
  purged_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deletion request"
  ON public.account_deletion_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all deletion requests"
  ON public.account_deletion_requests FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_pending_at timestamptz;

-- Data export requests
CREATE TABLE public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed')),
  download_url text,
  expires_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own exports"
  ON public.data_export_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own exports"
  ON public.data_export_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Seed initial ToS + Privacy v1
INSERT INTO public.legal_documents (doc_type, version, title, content_md, is_active) VALUES
('tos', 1, 'Terms of Service',
'# Terms of Service

_Last updated: 2026_

Welcome to ThriftPantry. By using this app you agree to these terms.

## 1. Use of the service
ThriftPantry helps you track pantry items, plan meals, and find grocery savings. The information shown (prices, nutrition, sales) is provided for convenience and may not always be accurate. Always verify in store.

## 2. Your account
You are responsible for keeping your login credentials safe and for activity under your account.

## 3. Acceptable use
Do not submit false sale data, harass other users, attempt to reverse-engineer the service, or use it to violate any law.

## 4. Content you submit
By submitting sale tips, store info, or other content, you grant ThriftPantry a non-exclusive license to display and use that content within the app.

## 5. Termination
You can delete your account at any time from Settings. We may suspend accounts that violate these terms.

## 6. No warranty
The service is provided "as is". We are not liable for missed savings, expired items, or pricing inaccuracies.

## 7. Changes
We may update these terms. Continued use after an update means you accept the new terms.

## 8. Contact
Questions? Reach out from the in-app support form.', true),
('privacy', 1, 'Privacy Policy',
'# Privacy Policy

_Last updated: 2026_

## What we collect
- Account info: email, display name, household size, ZIP, dietary preferences.
- Usage data: pantry items, meal plans, savings events, watchlist items, sale submissions.
- Device info: browser, IP address (for security and legal acceptance records).

## How we use it
- To provide pantry tracking, meal planning, price lookups, and notifications.
- To improve the app (anonymized analytics).
- To comply with legal obligations.

## Sharing
We do not sell your data. We share with:
- Service providers (hosting, AI inference, email delivery) under contract.
- Law enforcement when legally required.

## Your rights
- **Access / export**: download all your data from Settings.
- **Deletion**: request account deletion from Settings — there is a 30-day grace period.
- **Correction**: edit your profile any time.

## Data retention
Active accounts: retained while you use the service. Deleted accounts: purged 30 days after deletion request.

## Contact
Reach out from the in-app support form.', true);
