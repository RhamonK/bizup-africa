# MamaShop

Application mobile de gestion de boutique pour les petits commerces d'Afrique de l'Ouest.
Pensée pour des réseaux instables et des utilisateurs peu techniques : **offline-first**, interface simple en français, montants en FCFA.

## Fonctionnalités

- **Trois rôles, trois expériences** — chaque profil voit uniquement ses écrans :
  - 👩‍💼 **Gérant(e)** : tableau de bord, finances, marges, stock, fournisseurs, employés
  - 🛵 **Agent terrain** : ventes, arrivages de stock, crédits clients
  - 🌍 **Diaspora** : vue lecture seule pour la famille à l'étranger qui soutient le commerce
- **Mode hors-ligne** : les ventes et arrivages sont enregistrés localement puis synchronisés automatiquement au retour du réseau
- **Ventes transactionnelles** : création de vente, lignes et décrément de stock dans une seule transaction Postgres (RPC) — pas d'état incohérent
- **Crédits clients** : suivi des dettes, fiches clients, niveaux de fidélité
- **Aide à la négociation fournisseur** : conseils basés sur l'historique des prix payés
- **Photos produits & avatars** : upload vers Supabase Storage

## Stack technique

| Couche | Outil |
|---|---|
| Mobile | React Native + Expo SDK 54 (New Architecture) |
| Langage | TypeScript strict |
| Navigation | Expo Router (file-based) + drawer animé custom |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions (Deno) |
| Hors-ligne | AsyncStorage + file de synchronisation, détection réseau NetInfo |
| Sessions | expo-secure-store (Keychain iOS / Keystore Android) |

## Architecture

```
app/                  Écrans (Expo Router, un groupe de routes par rôle)
  (auth)/             Connexion
  (boss)/             Écrans gérant
  (terrain)/          Écrans agent terrain
  (diaspora)/         Écrans diaspora
components/           UI partagée, sans accès aux données
services/             Couche d'accès Supabase (products, sales, clients, …)
lib/                  Client Supabase, types partagés, file offline, réseau
hooks/                useAuth, useDrawer, useHamburgerHeader
constants/            Design tokens (palette de couleurs)
utils/                Fonctions pures (formatage FCFA, dates, quantités)
supabase/             Schéma SQL, migrations, edge functions
```

Principes :
- les composants ne parlent jamais à Supabase directement — tout passe par `services/`
- les écritures critiques (vente + stock) sont atomiques côté Postgres
- la sécurité des données repose sur les policies RLS (isolation par boutique)

## Lancer le projet

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env
# → renseigner l'URL et la clé anon de ton projet Supabase

# 3. Base de données
# Exécuter supabase/schema.sql puis les migrations v2 → v5 dans le SQL Editor Supabase

# 4. Démarrer
npx expo start
```

## Qualité

```bash
npm run typecheck   # TypeScript strict, 0 erreur
npm run lint        # ESLint (eslint-config-expo)
npm test            # Jest — formatage FCFA, file de synchronisation offline
```

Build APK de test : `eas build --platform android --profile preview` (nécessite un compte [expo.dev](https://expo.dev))

## Captures d'écran

*À venir.*
