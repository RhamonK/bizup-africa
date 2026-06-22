-- =============================================================
-- MamaShop — Création des comptes bêta-testeurs (Togo)
-- À exécuter dans Supabase > SQL Editor
-- Remplace les valeurs entre < > avant d'exécuter
-- =============================================================

-- ⚠️  IMPORTANT : exécute les blocs UN PAR UN pour chaque testeur.
--     Remplace à chaque fois : email, mot de passe, nom, rôle, shop_id.

-- -----------------------------------------------------------
-- ÉTAPE 1 — Récupère l'ID de la boutique (nécessaire pour profiles)
-- -----------------------------------------------------------
SELECT id, name FROM public.shops;
-- Copie l'UUID de la boutique pour le shop_id ci-dessous.


-- -----------------------------------------------------------
-- ÉTAPE 2 — Créer un compte TERRAIN (Agent de vente)
-- -----------------------------------------------------------

-- 2a. Créer l'utilisateur auth
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'terrain1@bizup.app',                          -- ← change l'email
  crypt('Bizup2025!', gen_salt('bf')),            -- ← change le mot de passe
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
)
RETURNING id;  -- ← copie l'UUID retourné pour l'étape 2b


-- 2b. Créer le profil (remplace 'UUID_RETOURNÉ' par l'id de l'étape 2a)
INSERT INTO public.profiles (
  id,
  shop_id,
  role,
  full_name,
  phone,
  is_active,
  created_at
) VALUES (
  'UUID_RETOURNÉ_ÉTAPE_2a',                      -- ← UUID de l'étape 2a
  'UUID_DE_LA_BOUTIQUE',                          -- ← UUID de l'étape 1
  'terrain',
  'Prénom Nom du testeur',                        -- ← nom complet
  '+228XXXXXXXX',                                 -- ← téléphone Togo
  true,
  now()
);


-- -----------------------------------------------------------
-- ÉTAPE 3 — Créer un compte BOSS (Gérant)
-- -----------------------------------------------------------

-- 3a. Créer l'utilisateur auth
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'boss2@bizup.app',                             -- ← change l'email
  crypt('Bizup2025!', gen_salt('bf')),            -- ← change le mot de passe
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
)
RETURNING id;  -- ← copie l'UUID retourné pour l'étape 3b


-- 3b. Créer le profil
INSERT INTO public.profiles (
  id,
  shop_id,
  role,
  full_name,
  phone,
  is_active,
  created_at
) VALUES (
  'UUID_RETOURNÉ_ÉTAPE_3a',                      -- ← UUID de l'étape 3a
  'UUID_DE_LA_BOUTIQUE',                          -- ← UUID de l'étape 1
  'boss',
  'Prénom Nom du gérant testeur',                 -- ← nom complet
  '+228XXXXXXXX',                                 -- ← téléphone Togo
  true,
  now()
);


-- -----------------------------------------------------------
-- ÉTAPE 4 — Vérification finale
-- -----------------------------------------------------------
SELECT
  u.email,
  p.full_name,
  p.role,
  p.phone,
  p.is_active,
  s.name AS shop_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.shops s ON s.id = p.shop_id
ORDER BY p.role, p.full_name;

-- Tu dois voir tous tes testeurs avec leur rôle et boutique. ✅


-- -----------------------------------------------------------
-- UTILITAIRE — Réinitialiser le mot de passe d'un testeur
-- -----------------------------------------------------------
-- UPDATE auth.users
-- SET encrypted_password = crypt('NouveauMotDePasse!', gen_salt('bf'))
-- WHERE email = 'email_du_testeur@bizup.app';
