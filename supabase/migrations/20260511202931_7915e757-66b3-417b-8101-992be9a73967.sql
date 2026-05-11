ALTER TABLE public.pantry_items ADD COLUMN IF NOT EXISTS barcode text;
CREATE INDEX IF NOT EXISTS pantry_items_barcode_idx ON public.pantry_items (user_id, barcode) WHERE barcode IS NOT NULL;