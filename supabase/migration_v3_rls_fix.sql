-- BiZ-Up Africa — Fix RLS INSERT + ajout table alertes
-- Exécuter dans Supabase SQL Editor

-- ── 1. FIX RLS : ajouter WITH CHECK pour les INSERT ──────────────────────────
-- Les policies FOR ALL USING ne couvrent pas les INSERT → on recrée proprement

ALTER TABLE shops          DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       DISABLE ROW LEVEL SECURITY;
ALTER TABLE products       DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients        DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales          DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers      DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE price_history  DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries  DISABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "profiles_own"       ON profiles;
DROP POLICY IF EXISTS "shops_member"       ON shops;
DROP POLICY IF EXISTS "products_shop"      ON products;
DROP POLICY IF EXISTS "clients_shop"       ON clients;
DROP POLICY IF EXISTS "sales_shop"         ON sales;
DROP POLICY IF EXISTS "suppliers_shop"     ON suppliers;
DROP POLICY IF EXISTS "stock_entries_shop" ON stock_entries;
DROP POLICY IF EXISTS "sale_items_shop"    ON sale_items;
DROP POLICY IF EXISTS "price_history_shop" ON price_history;
DROP POLICY IF EXISTS "supplier_products_shop" ON supplier_products;
DROP POLICY IF EXISTS "credit_payments_shop"   ON credit_payments;

-- Réactiver RLS
ALTER TABLE shops          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_entries  ENABLE ROW LEVEL SECURITY;

-- Nouvelles policies avec USING + WITH CHECK
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "shops_member" ON shops
  FOR ALL USING (id = my_shop_id()) WITH CHECK (id = my_shop_id());

CREATE POLICY "products_shop" ON products
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());

CREATE POLICY "clients_shop" ON clients
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());

CREATE POLICY "sales_shop" ON sales
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());

CREATE POLICY "suppliers_shop" ON suppliers
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());

CREATE POLICY "stock_entries_shop" ON stock_entries
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());

CREATE POLICY "sale_items_shop" ON sale_items
  FOR ALL
  USING (sale_id IN (SELECT id FROM sales WHERE shop_id = my_shop_id()))
  WITH CHECK (sale_id IN (SELECT id FROM sales WHERE shop_id = my_shop_id()));

CREATE POLICY "price_history_shop" ON price_history
  FOR ALL
  USING (supplier_id IN (SELECT id FROM suppliers WHERE shop_id = my_shop_id()))
  WITH CHECK (supplier_id IN (SELECT id FROM suppliers WHERE shop_id = my_shop_id()));

CREATE POLICY "supplier_products_shop" ON supplier_products
  FOR ALL
  USING (supplier_id IN (SELECT id FROM suppliers WHERE shop_id = my_shop_id()))
  WITH CHECK (supplier_id IN (SELECT id FROM suppliers WHERE shop_id = my_shop_id()));

CREATE POLICY "credit_payments_shop" ON credit_payments
  FOR ALL
  USING (client_id IN (SELECT id FROM clients WHERE shop_id = my_shop_id()))
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE shop_id = my_shop_id()));

-- ── 2. TABLE ALERTES (manquait dans le schema) ───────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('stock_faible', 'impaye', 'saison', 'prix_anormal')),
  message     TEXT NOT NULL,
  lu          BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_shop" ON alerts
  FOR ALL USING (shop_id = my_shop_id()) WITH CHECK (shop_id = my_shop_id());

-- Lecture seule diaspora sur alertes, ventes, produits
CREATE POLICY "alerts_diaspora_read" ON alerts
  FOR SELECT USING (
    shop_id IN (
      SELECT shop_id FROM profiles
      WHERE id = auth.uid() AND role = 'diaspora'
    )
  );

-- ── 3. FONCTION DÉCRÉMENT STOCK (pour sync offline) ─────────────────────────
CREATE OR REPLACE FUNCTION decrement_stock(p_id UUID, qty NUMERIC)
RETURNS void LANGUAGE sql AS $$
  UPDATE products SET stock_quantity = stock_quantity - qty WHERE id = p_id;
$$;

-- ── 4. DONNÉES DE TEST (optionnel) ───────────────────────────────────────────
-- Décommente et adapte après avoir créé ton shop et tes produits :

-- INSERT INTO alerts (shop_id, type, message) VALUES
--   ('<SHOP_ID>', 'stock_faible', '🌶️ Piments — stock critique : 3 caisses'),
--   ('<SHOP_ID>', 'impaye',       'Ama Koffi doit 27 500 F depuis 8 jours'),
--   ('<SHOP_ID>', 'saison',       'Saison sèche dans 3 semaines — prix tomates vont monter');
