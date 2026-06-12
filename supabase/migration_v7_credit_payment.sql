-- =============================================================
-- Migration v7 — encaissement de crédit atomique
-- Insère le paiement et décrémente la dette dans une seule
-- transaction (plancher à 0). Remplace le pattern
-- insert + lecture + update côté client.
-- =============================================================

CREATE OR REPLACE FUNCTION apply_credit_payment(p_client_id UUID, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO credit_payments (client_id, amount, date)
  VALUES (p_client_id, p_amount, CURRENT_DATE);

  UPDATE clients
  SET total_debt = GREATEST(0, total_debt - p_amount)
  WHERE id = p_client_id;
END;
$$;
