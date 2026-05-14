-- BiZ-Up Africa — Migration v4 : chauffeur sur les livraisons
-- Exécuter dans Supabase SQL Editor

ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS driver_name  TEXT;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS notes        TEXT;

-- Vue pratique : livraisons avec infos fournisseur + chauffeur
CREATE OR REPLACE VIEW livraisons AS
  SELECT
    se.id,
    se.shop_id,
    p.name        AS produit,
    p.unit        AS unite,
    se.quantity   AS quantite,
    se.cost_per_unit AS prix_achat,
    se.quantity * se.cost_per_unit AS montant_total,
    s.name        AS fournisseur,
    s.phone       AS tel_fournisseur,
    se.driver_name  AS chauffeur,
    se.driver_phone AS tel_chauffeur,
    se.notes,
    se.date
  FROM stock_entries se
  JOIN products p ON p.id = se.product_id
  LEFT JOIN suppliers s ON s.id = se.supplier_id
  ORDER BY se.date DESC, se.created_at DESC;
