-- =============================================================
-- Migration v5 — incrément de stock atomique
-- Miroir de decrement_stock (migration_v3) : évite le pattern
-- lecture → addition → écriture qui perd des mises à jour
-- quand deux agents enregistrent un arrivage en même temps.
-- =============================================================

CREATE OR REPLACE FUNCTION increment_stock(p_id UUID, qty NUMERIC)
RETURNS void LANGUAGE sql AS $$
  UPDATE products SET stock_quantity = stock_quantity + qty WHERE id = p_id;
$$;
