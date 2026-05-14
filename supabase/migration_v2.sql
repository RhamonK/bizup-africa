-- MamaShop — Migration v2 : profils complets, clients enrichis, fournisseurs produits
-- À exécuter dans Supabase SQL Editor APRÈS le schema.sql initial

-- ─── PROFILES : poste, salaire, photo ───────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title     TEXT;           -- ex: vendeur, caissier, livreur
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS salary        NUMERIC(12,0);  -- FCFA/mois
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date     DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT TRUE;

-- ─── CLIENTS : adresse, préférences, notes ──────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address             TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS product_preferences TEXT[];     -- ex: {'Tomates','Piments'}
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_payment   TEXT DEFAULT 'cash' CHECK (preferred_payment IN ('cash','credit','mixed'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes               TEXT;

-- ─── SUPPLIERS : délai livraison, quantité min, notes ───────────────────────
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivery_days  INT DEFAULT 1;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS min_quantity   NUMERIC(10,2);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes          TEXT;

-- ─── STORAGE : bucket avatars ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
