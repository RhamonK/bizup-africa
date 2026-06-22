-- MamaShop — Schéma SQL complet v2.0
-- À exécuter dans l'éditeur SQL de ton projet Supabase

-- ─────────────────────────────────────────────
-- 1. SHOPS — Boutique / commerce
-- ─────────────────────────────────────────────
CREATE TABLE shops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  city        TEXT NOT NULL DEFAULT 'Lomé',
  country     TEXT NOT NULL DEFAULT 'Togo',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. PROFILES — Utilisateurs (employés + patronnes)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id     UUID REFERENCES shops(id) ON DELETE SET NULL,
  role        TEXT NOT NULL CHECK (role IN ('boss', 'terrain', 'diaspora')) DEFAULT 'terrain',
  full_name   TEXT NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'), 'terrain');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────
-- 3. PRODUCTS — Catalogue produits
-- ─────────────────────────────────────────────
CREATE TABLE products (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                  UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  unit                     TEXT NOT NULL DEFAULT 'caisse',
  current_price            NUMERIC(12,0) NOT NULL DEFAULT 0,
  stock_quantity           NUMERIC(10,2) NOT NULL DEFAULT 0,
  alert_threshold          NUMERIC(10,2) NOT NULL DEFAULT 5,
  alert_days_without_sale  INT NOT NULL DEFAULT 2,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. CLIENTS — Carnet clients
-- ─────────────────────────────────────────────
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  level       TEXT NOT NULL CHECK (level IN ('standard', 'vip', 'grand_compte')) DEFAULT 'standard',
  total_debt  NUMERIC(12,0) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. SALES — Ventes
-- ─────────────────────────────────────────────
CREATE TABLE sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES profiles(id),
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  total_amount  NUMERIC(12,0) NOT NULL DEFAULT 0,
  paid_amount   NUMERIC(12,0) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    NUMERIC(10,2) NOT NULL,
  unit_price  NUMERIC(12,0) NOT NULL,
  total       NUMERIC(12,0) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update client debt when credit sale is made
CREATE OR REPLACE FUNCTION update_client_debt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NEW.credit_amount > 0 THEN
    UPDATE clients SET total_debt = total_debt + NEW.credit_amount
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sale_created
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION update_client_debt();

-- ─────────────────────────────────────────────
-- 6. CREDIT PAYMENTS — Remboursements
-- ─────────────────────────────────────────────
CREATE TABLE credit_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount      NUMERIC(12,0) NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 7. SUPPLIERS — Fournisseurs saisonniers
-- ─────────────────────────────────────────────
CREATE TABLE suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  whatsapp    TEXT,
  zone        TEXT,
  season      TEXT NOT NULL CHECK (season IN ('dry', 'rainy', 'all_year')) DEFAULT 'dry',
  reliability INT NOT NULL CHECK (reliability BETWEEN 1 AND 5) DEFAULT 3,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supplier_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE (supplier_id, product_id)
);

-- ─────────────────────────────────────────────
-- 8. PRICE HISTORY — Historique prix fournisseurs
-- ─────────────────────────────────────────────
CREATE TABLE price_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_per_unit NUMERIC(12,0) NOT NULL,
  quality       INT NOT NULL CHECK (quality BETWEEN 1 AND 5) DEFAULT 3,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  season        TEXT NOT NULL CHECK (season IN ('dry', 'rainy')) DEFAULT 'dry',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 9. STOCK ENTRIES — Arrivages
-- ─────────────────────────────────────────────
CREATE TABLE stock_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity      NUMERIC(10,2) NOT NULL,
  cost_per_unit NUMERIC(12,0) NOT NULL DEFAULT 0,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────
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

-- Helper function: get shop_id for current user
CREATE OR REPLACE FUNCTION my_shop_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$;

-- Profiles: can only see own profile
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (id = auth.uid());

-- Shops: members of the shop
CREATE POLICY "shops_member" ON shops
  FOR ALL USING (id = my_shop_id());

-- Products, clients, sales, etc.: shop members only
CREATE POLICY "products_shop" ON products FOR ALL USING (shop_id = my_shop_id());
CREATE POLICY "clients_shop"  ON clients  FOR ALL USING (shop_id = my_shop_id());
CREATE POLICY "sales_shop"    ON sales    FOR ALL USING (shop_id = my_shop_id());
CREATE POLICY "suppliers_shop" ON suppliers FOR ALL USING (shop_id = my_shop_id());
CREATE POLICY "stock_entries_shop" ON stock_entries FOR ALL USING (shop_id = my_shop_id());

CREATE POLICY "sale_items_shop" ON sale_items
  FOR ALL USING (
    sale_id IN (SELECT id FROM sales WHERE shop_id = my_shop_id())
  );

CREATE POLICY "price_history_shop" ON price_history
  FOR ALL USING (
    supplier_id IN (SELECT id FROM suppliers WHERE shop_id = my_shop_id())
  );

CREATE POLICY "supplier_products_shop" ON supplier_products
  FOR ALL USING (
    supplier_id IN (SELECT id FROM suppliers WHERE shop_id = my_shop_id())
  );

CREATE POLICY "credit_payments_shop" ON credit_payments
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE shop_id = my_shop_id())
  );

-- ─────────────────────────────────────────────
-- 11. DONNÉES DE DEMO (optionnel - à commenter en prod)
-- ─────────────────────────────────────────────
-- Décommente et adapte si tu veux tester avec des données fictives.
-- INSERT INTO shops (id, name, owner_id, city, country) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Marché Mama Adjoua', '<TON_USER_ID>', 'Lomé', 'Togo');
--
-- INSERT INTO products (shop_id, name, unit, current_price, stock_quantity, alert_threshold) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Tomates', 'caisse', 3200, 15, 5),
--   ('00000000-0000-0000-0000-000000000001', 'Piments', 'caisse', 7500, 8, 3),
--   ('00000000-0000-0000-0000-000000000001', 'Oignons', 'sac', 4500, 20, 5);
