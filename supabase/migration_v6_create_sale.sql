-- =============================================================
-- Migration v6 — vente transactionnelle
-- Exporte la fonction create_sale (créée à l'origine via le
-- dashboard) pour que le schéma soit entièrement reconstructible
-- depuis le repo. Ajoute aussi la colonne pay_mode absente du
-- schema.sql initial.
-- =============================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS pay_mode TEXT NOT NULL DEFAULT 'cash';

-- Crée la vente, ses lignes et décrémente le stock dans UNE transaction :
-- si une étape échoue, tout est annulé (pas de vente sans lignes ni stock fantôme).
CREATE OR REPLACE FUNCTION public.create_sale(
  p_shop_id uuid,
  p_created_by uuid,
  p_total_amount numeric,
  p_paid_amount numeric,
  p_credit_amount numeric,
  p_date date,
  p_pay_mode text,
  p_items jsonb
)
RETURNS SETOF sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale    sales;
  v_item    JSONB;
BEGIN
  -- Insérer la vente
  INSERT INTO sales (shop_id, created_by, total_amount, paid_amount, credit_amount, date, pay_mode)
  VALUES (p_shop_id, p_created_by, p_total_amount, p_paid_amount, p_credit_amount, p_date, p_pay_mode)
  RETURNING * INTO v_sale;

  -- Insérer chaque item + mettre à jour le stock atomiquement
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
    VALUES (
      v_sale.id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );

    -- Décrémenter le stock (jamais en dessous de 0)
    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - (v_item->>'quantity')::NUMERIC)
    WHERE id = (v_item->>'product_id')::UUID
      AND shop_id = p_shop_id;  -- sécurité : vérifier que le produit appartient au shop
  END LOOP;

  RETURN NEXT v_sale;
END;
$function$;
