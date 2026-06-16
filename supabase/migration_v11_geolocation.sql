-- =============================================================
-- Migration v11 — géolocalisation (déstockage phase 2)
-- Position GPS des clientes (acheteuses) et des lots, pour cibler
-- les acheteuses à proximité quand un prix est cassé.
-- 100% local : capture via le GPS du téléphone, requête via PostGIS.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Position des acheteuses + consentement à être prévenues
ALTER TABLE clients ADD COLUMN IF NOT EXISTS latitude         double precision;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS longitude        double precision;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS position_consent boolean NOT NULL DEFAULT true;

-- Position de l'arrivage (où est le camion / le lot)
ALTER TABLE destock_lots ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE destock_lots ADD COLUMN IF NOT EXISTS longitude double precision;

-- Acheteuses de la boutique à moins de p_radius_m mètres d'un point, triées par distance.
-- SECURITY INVOKER (défaut) → respecte la RLS : on ne voit que ses propres clientes.
CREATE OR REPLACE FUNCTION clients_near_point(p_lat double precision, p_lng double precision, p_radius_m integer DEFAULT 3000)
RETURNS TABLE (id uuid, name text, phone text, distance_m double precision)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT c.id, c.name, c.phone,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m
  FROM clients c
  WHERE c.shop_id = my_shop_id()
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND c.position_consent
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(c.longitude, c.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_m;
$$;
