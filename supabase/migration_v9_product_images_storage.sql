-- =============================================================
-- Migration v9 — fix upload photos produits (Storage RLS)
-- Le bucket product-images avait INSERT + SELECT + DELETE mais
-- PAS de policy UPDATE. Or l'upload se fait avec upsert:true →
-- remplacer une photo = UPDATE → bloqué par RLS.
-- La policy DELETE comparait aussi auth.uid() au dossier (= shop_id),
-- donc elle ne matchait jamais. On corrige les deux.
-- =============================================================

-- UPDATE manquante : permet l'upsert (remplacement de photo)
CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

-- DELETE corrigée (l'ancienne ne pouvait jamais matcher)
DROP POLICY IF EXISTS "Owner can update/delete product images" ON storage.objects;
CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
