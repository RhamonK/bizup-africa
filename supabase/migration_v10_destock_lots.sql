-- =============================================================
-- Migration v10 — déstockage rapide (lots à prix décroissant)
-- Un "lot" = un arrivage qu'on déstocke avec une décote horaire
-- automatique pour éviter le pourrissement (tomates, etc.).
-- Phase 1 : prix calculé côté app, pas de notification ni paiement.
-- =============================================================

CREATE TABLE IF NOT EXISTS destock_lots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_by         UUID NOT NULL REFERENCES profiles(id),
  product_name       TEXT NOT NULL,
  unit               TEXT NOT NULL DEFAULT 'caisse',
  location_label     TEXT,
  quantity           NUMERIC(10,2) NOT NULL,
  quantity_remaining NUMERIC(10,2) NOT NULL,
  base_price         NUMERIC(12,0) NOT NULL,   -- prix de départ
  floor_price        NUMERIC(12,0) NOT NULL,   -- plancher, jamais en dessous
  window_hours       INT NOT NULL DEFAULT 24,  -- durée avant d'atteindre le plancher
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold_out','closed')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS destock_lots_shop_status_idx ON destock_lots (shop_id, status);

ALTER TABLE destock_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destock_lots_shop" ON destock_lots
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());
