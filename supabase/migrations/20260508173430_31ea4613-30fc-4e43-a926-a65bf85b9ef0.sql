
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cuisine_preferences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cuisine_filter_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.bulk_buy_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_name text NOT NULL,
  cuisine_tags text[] NOT NULL DEFAULT '{}',
  typical_unit_price_usd numeric NOT NULL,
  bulk_unit_price_usd numeric NOT NULL,
  bulk_pack_size text NOT NULL,
  est_savings_pct integer NOT NULL,
  shelf_life_days integer NOT NULL,
  storage_tip text,
  best_store_type text,
  confidence text NOT NULL DEFAULT 'medium',
  source text NOT NULL DEFAULT 'curated',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_buy_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views bulk_buy_candidates"
  ON public.bulk_buy_candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert bulk_buy_candidates"
  ON public.bulk_buy_candidates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update bulk_buy_candidates"
  ON public.bulk_buy_candidates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete bulk_buy_candidates"
  ON public.bulk_buy_candidates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER bulk_buy_candidates_updated_at
  BEFORE UPDATE ON public.bulk_buy_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_bulk_buy_cuisine ON public.bulk_buy_candidates USING GIN (cuisine_tags);

INSERT INTO public.bulk_buy_candidates (food_name, cuisine_tags, typical_unit_price_usd, bulk_unit_price_usd, bulk_pack_size, est_savings_pct, shelf_life_days, storage_tip, best_store_type, confidence, source) VALUES
-- South Asian
('Basmati rice', ARRAY['south_asian'], 0.18, 0.09, '20 lb bag', 50, 730, 'Airtight bin, cool dry pantry. Add bay leaves to deter pests.', 'south_asian_grocer', 'high', 'curated'),
('Red lentils (masoor dal)', ARRAY['south_asian'], 0.22, 0.11, '8 lb bag', 50, 365, 'Airtight container, dry pantry.', 'south_asian_grocer', 'high', 'curated'),
('Chickpeas (dried)', ARRAY['south_asian','middle_eastern','mediterranean'], 0.20, 0.10, '10 lb bag', 50, 365, 'Airtight container; soak overnight before use.', 'south_asian_grocer', 'high', 'curated'),
('Ghee', ARRAY['south_asian'], 1.10, 0.65, '32 oz tin', 41, 365, 'Pantry once opened; refrigerate for max shelf life.', 'south_asian_grocer', 'high', 'curated'),
('Garam masala', ARRAY['south_asian'], 2.50, 0.90, '7 oz pouch', 64, 540, 'Airtight jar away from heat.', 'south_asian_grocer', 'high', 'curated'),
('Cumin seed (whole)', ARRAY['south_asian','middle_eastern'], 1.80, 0.55, '14 oz pouch', 70, 730, 'Whole spices keep longer than ground.', 'south_asian_grocer', 'high', 'curated'),
('Turmeric powder', ARRAY['south_asian'], 1.50, 0.45, '14 oz pouch', 70, 540, 'Dark airtight jar.', 'south_asian_grocer', 'high', 'curated'),
('Paneer', ARRAY['south_asian'], 0.55, 0.32, '2 lb block', 42, 14, 'Refrigerate; freeze cubed for up to 3 months.', 'south_asian_grocer', 'medium', 'curated'),
-- Korean
('Gochujang', ARRAY['korean'], 0.40, 0.20, '6.6 lb tub', 50, 540, 'Refrigerate after opening.', 'korean_grocer', 'high', 'curated'),
('Gochugaru (chili flakes)', ARRAY['korean'], 1.20, 0.50, '2.2 lb bag', 58, 365, 'Freeze for color and flavor retention.', 'korean_grocer', 'high', 'curated'),
('Korean soy sauce', ARRAY['korean'], 0.18, 0.10, '1.8 L jug', 44, 730, 'Cool dark pantry.', 'korean_grocer', 'high', 'curated'),
('Doenjang', ARRAY['korean'], 0.45, 0.25, '2.2 lb tub', 44, 540, 'Refrigerate after opening.', 'korean_grocer', 'high', 'curated'),
-- Japanese
('Short-grain rice', ARRAY['japanese'], 0.20, 0.11, '15 lb bag', 45, 730, 'Airtight bin, cool pantry.', 'japanese_grocer', 'high', 'curated'),
('Miso paste', ARRAY['japanese'], 0.55, 0.28, '2.2 lb tub', 49, 365, 'Refrigerate; surface darkening is normal.', 'japanese_grocer', 'high', 'curated'),
('Nori sheets', ARRAY['japanese'], 0.40, 0.18, '100 sheet pack', 55, 365, 'Airtight with silica gel; freezer for long-term.', 'japanese_grocer', 'high', 'curated'),
('Panko breadcrumbs', ARRAY['japanese'], 0.30, 0.14, '5 lb bag', 53, 180, 'Airtight; freeze portions for freshness.', 'japanese_grocer', 'medium', 'curated'),
-- Chinese
('Soy sauce', ARRAY['chinese','japanese','korean'], 0.20, 0.10, '1.75 L jug', 50, 730, 'Cool pantry; refrigerate after opening for best flavor.', 'chinese_grocer', 'high', 'curated'),
('Oyster sauce', ARRAY['chinese'], 0.45, 0.22, '2.27 kg jug', 51, 540, 'Refrigerate after opening.', 'chinese_grocer', 'high', 'curated'),
('Shaoxing wine', ARRAY['chinese'], 0.35, 0.18, '1.8 L jug', 49, 730, 'Cool dark pantry.', 'chinese_grocer', 'high', 'curated'),
('Sichuan peppercorns', ARRAY['chinese'], 3.50, 1.20, '8 oz bag', 66, 540, 'Airtight, dark, dry.', 'chinese_grocer', 'high', 'curated'),
-- Southeast Asian
('Fish sauce', ARRAY['southeast_asian'], 0.30, 0.14, '24 oz bottle', 53, 730, 'Cool pantry; flavor improves with age.', 'southeast_asian_grocer', 'high', 'curated'),
('Coconut milk (cans)', ARRAY['southeast_asian','south_asian'], 2.50, 1.40, '12-pack 13.5oz', 44, 730, 'Pantry. Shake well before use.', 'southeast_asian_grocer', 'high', 'curated'),
('Jasmine rice', ARRAY['southeast_asian'], 0.18, 0.09, '25 lb bag', 50, 730, 'Airtight bin, cool pantry.', 'southeast_asian_grocer', 'high', 'curated'),
('Rice noodles', ARRAY['southeast_asian','chinese'], 0.40, 0.20, '5 lb case', 50, 540, 'Cool dry pantry.', 'southeast_asian_grocer', 'high', 'curated'),
('Sriracha', ARRAY['southeast_asian'], 0.30, 0.15, '4-pack 28oz', 50, 730, 'Pantry. Refrigerate after opening for color.', 'southeast_asian_grocer', 'high', 'curated'),
-- Middle Eastern
('Tahini', ARRAY['middle_eastern','mediterranean'], 0.55, 0.28, '4 lb tub', 49, 540, 'Stir before use; refrigerate after opening.', 'middle_eastern_grocer', 'high', 'curated'),
('Sumac', ARRAY['middle_eastern'], 2.80, 1.10, '1 lb bag', 61, 540, 'Airtight, dark.', 'middle_eastern_grocer', 'high', 'curated'),
('Za''atar blend', ARRAY['middle_eastern'], 2.20, 0.95, '1 lb bag', 57, 365, 'Airtight; refrigerate to keep oils fresh.', 'middle_eastern_grocer', 'high', 'curated'),
('Bulgur wheat', ARRAY['middle_eastern'], 0.35, 0.16, '10 lb bag', 54, 365, 'Airtight container.', 'middle_eastern_grocer', 'high', 'curated'),
('Pomegranate molasses', ARRAY['middle_eastern'], 0.60, 0.32, '32 oz bottle', 47, 540, 'Pantry; refrigerate after opening.', 'middle_eastern_grocer', 'medium', 'curated'),
-- Mexican / Latin American
('Masa harina', ARRAY['mexican'], 0.30, 0.15, '10 lb bag', 50, 365, 'Airtight; freeze for long-term.', 'mexican_grocer', 'high', 'curated'),
('Corn tortillas', ARRAY['mexican'], 0.10, 0.05, '5 dozen pack', 50, 30, 'Refrigerate; freeze for up to 6 months.', 'mexican_grocer', 'high', 'curated'),
('Dried pinto beans', ARRAY['mexican','latin_american'], 0.18, 0.09, '20 lb bag', 50, 730, 'Airtight container.', 'mexican_grocer', 'high', 'curated'),
('Dried chiles (ancho/guajillo)', ARRAY['mexican'], 1.20, 0.55, '1 lb bag', 54, 540, 'Airtight, dry, dark.', 'mexican_grocer', 'high', 'curated'),
('Chipotle in adobo', ARRAY['mexican'], 0.65, 0.35, '6-pack 7oz cans', 46, 730, 'Pantry; freeze leftovers in 1-tbsp portions.', 'mexican_grocer', 'high', 'curated'),
-- Mediterranean
('Extra virgin olive oil', ARRAY['mediterranean'], 0.45, 0.25, '3 L tin', 44, 540, 'Cool dark pantry; light degrades flavor.', 'mediterranean_grocer', 'high', 'curated'),
('Kalamata olives', ARRAY['mediterranean'], 0.55, 0.28, '4 lb jar', 49, 365, 'Refrigerate after opening, keep submerged.', 'mediterranean_grocer', 'medium', 'curated'),
('Feta cheese', ARRAY['mediterranean'], 0.60, 0.35, '4 lb tin (in brine)', 42, 180, 'Refrigerate in brine; lasts months unopened.', 'mediterranean_grocer', 'medium', 'curated'),
-- African
('Berbere spice', ARRAY['african'], 2.50, 1.05, '1 lb bag', 58, 540, 'Airtight, dark.', 'african_grocer', 'high', 'curated'),
('Teff flour', ARRAY['african'], 0.45, 0.22, '5 lb bag', 51, 365, 'Airtight; refrigerate for long-term.', 'african_grocer', 'medium', 'curated'),
-- Generic staples (no cuisine)
('All-purpose flour', ARRAY[]::text[], 0.10, 0.06, '25 lb bag', 40, 365, 'Airtight bin; freeze 48h on arrival to kill any pests.', NULL, 'high', 'curated'),
('Granulated sugar', ARRAY[]::text[], 0.08, 0.05, '25 lb bag', 38, 730, 'Airtight bin.', NULL, 'high', 'curated'),
('Rolled oats', ARRAY[]::text[], 0.12, 0.07, '25 lb bag', 42, 365, 'Airtight bin, cool pantry.', NULL, 'high', 'curated');
