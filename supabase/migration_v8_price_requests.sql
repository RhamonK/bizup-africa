-- =============================================================
-- Migration v8 — demandes de prix (validation patron)
-- L'agent peut demander un prix spécial au patron depuis la vente.
-- Le patron accepte/refuse depuis son téléphone, l'agent est
-- notifié en temps réel. Remplace l'appel téléphonique.
-- =============================================================

CREATE TABLE IF NOT EXISTS price_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,           -- dénormalisé : reste lisible même si le produit change
  client_name     TEXT,
  requested_price NUMERIC(12,0) NOT NULL,
  approved_price  NUMERIC(12,0),           -- le patron peut accepter un prix différent
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  resolved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS price_requests_shop_pending_idx
  ON price_requests (shop_id, status);

ALTER TABLE price_requests ENABLE ROW LEVEL SECURITY;

-- Même règle que le reste : tout est cloisonné par boutique
CREATE POLICY "price_requests_shop" ON price_requests
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());

-- Temps réel : l'agent et le patron reçoivent les changements en direct.
-- REPLICA IDENTITY FULL → les filtres (shop_id) marchent aussi sur UPDATE/DELETE,
-- pas seulement sur INSERT.
ALTER TABLE price_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE price_requests;
