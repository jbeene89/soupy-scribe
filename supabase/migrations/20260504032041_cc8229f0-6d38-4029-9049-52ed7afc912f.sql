-- ──────────────────────────────────────────────
-- Supply Utilization Audit (OR Readiness extension)
-- ──────────────────────────────────────────────

CREATE TABLE public.supply_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NULL,                      -- NULL = system/demo rows
  sku text NOT NULL,
  description text NOT NULL,
  vendor text,
  category text,                           -- e.g. 'suture','drape','sponge','implant'
  pack_size integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  equivalent_sku text,                     -- multi-pack alternative SKU (same row table)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supply_catalog_owner ON public.supply_catalog (owner_id);
CREATE INDEX idx_supply_catalog_sku ON public.supply_catalog (sku);

ALTER TABLE public.supply_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access supply_catalog"
  ON public.supply_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own or demo supply_catalog"
  ON public.supply_catalog FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "Users insert own supply_catalog"
  ON public.supply_catalog FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own supply_catalog"
  ON public.supply_catalog FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users delete own supply_catalog"
  ON public.supply_catalog FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER trg_supply_catalog_updated
  BEFORE UPDATE ON public.supply_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Preference cards ──────────────────────────
CREATE TABLE public.preference_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  surgeon_name text NOT NULL,
  procedure_label text NOT NULL,
  service_line text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{sku, description, quantity}]
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_preference_cards_owner ON public.preference_cards (owner_id);
CREATE INDEX idx_preference_cards_lookup ON public.preference_cards (owner_id, surgeon_name, procedure_label);

ALTER TABLE public.preference_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access preference_cards"
  ON public.preference_cards FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own preference_cards"
  ON public.preference_cards FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Users insert own preference_cards"
  ON public.preference_cards FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own preference_cards"
  ON public.preference_cards FOR UPDATE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Users delete own preference_cards"
  ON public.preference_cards FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_preference_cards_updated
  BEFORE UPDATE ON public.preference_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Supply waste events ───────────────────────
CREATE TABLE public.supply_waste_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  case_id uuid NULL,
  surgeon_name text,
  procedure_label text,
  service_line text,
  room_id text,
  opened_items jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{sku, description, qty, unit_price}]
  used_items jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{sku, qty}]
  waste_cost numeric NOT NULL DEFAULT 0,
  savings_opportunity numeric NOT NULL DEFAULT 0,
  suggested_swap text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supply_waste_events_owner ON public.supply_waste_events (owner_id);
CREATE INDEX idx_supply_waste_events_case ON public.supply_waste_events (case_id);

ALTER TABLE public.supply_waste_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access supply_waste_events"
  ON public.supply_waste_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own supply_waste_events"
  ON public.supply_waste_events FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Users insert own supply_waste_events"
  ON public.supply_waste_events FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own supply_waste_events"
  ON public.supply_waste_events FOR UPDATE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Users delete own supply_waste_events"
  ON public.supply_waste_events FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ─── Seeded demo catalog (owner_id NULL = visible to all) ─────────
INSERT INTO public.supply_catalog (owner_id, sku, description, vendor, category, pack_size, unit_price, equivalent_sku, notes) VALUES
  (NULL, 'VCP318H',     'Vicryl 3-0 18in CT-1 (single)',         'Ethicon',  'suture',  1, 28.00, 'VCP318H-4PK', 'Surgeons routinely open 4 — 4-pack is cheaper.'),
  (NULL, 'VCP318H-4PK', 'Vicryl 3-0 18in CT-1 (4-pack)',         'Ethicon',  'suture',  4, 62.00, NULL, 'Bulk SKU equivalent.'),
  (NULL, 'PDS220H',     'PDS II 2-0 27in CT-1 (single)',         'Ethicon',  'suture',  1, 31.00, 'PDS220H-3PK', NULL),
  (NULL, 'PDS220H-3PK', 'PDS II 2-0 27in CT-1 (3-pack)',         'Ethicon',  'suture',  3, 51.00, NULL, NULL),
  (NULL, 'MONO40-PS2',  'Monocryl 4-0 PS-2 (single)',            'Ethicon',  'suture',  1, 24.00, 'MONO40-PS2-6PK', NULL),
  (NULL, 'MONO40-PS2-6PK','Monocryl 4-0 PS-2 (6-pack)',          'Ethicon',  'suture',  6, 92.00, NULL, NULL),
  (NULL, 'LAPSPNG-5',   'Lap sponge 18x18 (5-pack)',             'Cardinal', 'sponge',  5, 14.50, NULL, 'Default sponge SKU.'),
  (NULL, 'RAYTEC-10',   'Raytec 4x4 sponge (10-pack)',           'Cardinal', 'sponge', 10, 8.25,  NULL, NULL),
  (NULL, 'DRAPE-LAP',   'Universal laparotomy drape',            'Medline',  'drape',   1, 38.00, NULL, NULL),
  (NULL, 'DRAPE-EXTRA', 'Auxiliary side drape (often unused)',   'Medline',  'drape',   1, 12.00, NULL, 'Frequently opened-not-used per pref-card audits.'),
  (NULL, 'GOWN-XL',     'Sterile gown XL',                       'Medline',  'gown',    1, 9.50,  NULL, NULL),
  (NULL, 'MAYO-COVER',  'Mayo stand cover',                      'Medline',  'cover',   1, 6.75,  NULL, 'Often opened reflexively.'),
  (NULL, 'PILLOW-GEL',  'Gel positioning pillow',                'Action',   'positioning', 1, 22.00, NULL, NULL),
  (NULL, 'TROCAR-12',   '12mm bladeless trocar (single)',        'Medtronic','instrument', 1, 88.00, 'TROCAR-12-3PK', NULL),
  (NULL, 'TROCAR-12-3PK','12mm bladeless trocar (3-pack)',       'Medtronic','instrument', 3, 215.00, NULL, NULL);
