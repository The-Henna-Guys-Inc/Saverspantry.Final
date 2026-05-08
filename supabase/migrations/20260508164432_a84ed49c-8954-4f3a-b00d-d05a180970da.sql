
CREATE TABLE public.operational_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_alerts_unresolved ON public.operational_alerts (created_at DESC) WHERE resolved = false;
CREATE INDEX idx_op_alerts_type ON public.operational_alerts (alert_type, created_at DESC);

ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view alerts" ON public.operational_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert alerts" ON public.operational_alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update alerts" ON public.operational_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete alerts" ON public.operational_alerts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_op_alerts_updated_at
  BEFORE UPDATE ON public.operational_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_alert(
  _alert_type TEXT,
  _severity TEXT,
  _title TEXT,
  _message TEXT,
  _metadata JSONB DEFAULT '{}'::jsonb,
  _dedupe_minutes INT DEFAULT 60
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing UUID;
  new_id UUID;
BEGIN
  SELECT id INTO existing FROM public.operational_alerts
   WHERE alert_type = _alert_type AND resolved = false
     AND created_at > now() - make_interval(mins => _dedupe_minutes)
   ORDER BY created_at DESC LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;
  INSERT INTO public.operational_alerts(alert_type, severity, title, message, metadata)
    VALUES (_alert_type, _severity, _title, _message, COALESCE(_metadata,'{}'::jsonb))
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
