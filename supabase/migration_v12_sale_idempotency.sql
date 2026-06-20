-- =============================================================
-- Migration v12 — idempotence des ventes (anti-doublon)
-- Une clé d'idempotence (client_key) générée côté client à l'ouverture
-- du formulaire empêche qu'un même envoi (double-clic, retry réseau,
-- rejeu de la file hors-ligne) crée deux ventes. create_sale renvoie
-- alors la vente existante SANS re-décrémenter le stock.
-- =============================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_key uuid;

-- Index unique partiel : unicité seulement quand une clé est fournie
-- (les anciennes ventes sans clé restent valides).
CREATE UNIQUE INDEX IF NOT EXISTS sales_client_key_uniq
  ON sales (client_key) WHERE client_key IS NOT NULL;

-- Ancienne signature (8 args) remplacée par la version avec p_client_key.
DROP FUNCTION IF EXISTS create_sale(uuid, uuid, numeric, numeric, numeric, date, text, jsonb);

CREATE OR REPLACE FUNCTION create_sale(
  p_shop_id uuid,
  p_created_by uuid,
  p_total_amount numeric,
  p_paid_amount numeric,
  p_credit_amount numeric,
  p_date date,
  p_pay_mode text,
  p_items jsonb,
  p_client_key uuid DEFAULT NULL
)
RETURNS SETOF sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale sales;
  v_item jsonb;
BEGIN
  INSERT INTO sales (shop_id, created_by, total_amount, paid_amount, credit_amount, date, pay_mode, client_key)
  VALUES (p_shop_id, p_created_by, p_total_amount, p_paid_amount, p_credit_amount, p_date, p_pay_mode, p_client_key)
  ON CONFLICT (client_key) WHERE client_key IS NOT NULL DO NOTHING
  RETURNING * INTO v_sale;

  -- Clé déjà enregistrée : on renvoie la vente existante, sans toucher au stock.
  IF v_sale.id IS NULL THEN
    IF p_client_key IS NOT NULL THEN
      SELECT * INTO v_sale FROM sales WHERE client_key = p_client_key;
      IF v_sale.id IS NOT NULL THEN
        RETURN NEXT v_sale;
      END IF;
    END IF;
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
    VALUES (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total')::numeric
    );

    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - (v_item->>'quantity')::numeric)
    WHERE id = (v_item->>'product_id')::uuid
      AND shop_id = p_shop_id;
  END LOOP;

  RETURN NEXT v_sale;
END;
$function$;
