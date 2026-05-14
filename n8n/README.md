# BiZ-Up Africa — Configuration n8n

## Vue d'ensemble

n8n gère toutes les automatisations WhatsApp, alertes et rapports de BiZ-Up Africa.
Chaque workflow est déclenché soit par un webhook Supabase, soit par un cron.

---

## Variables d'environnement à configurer dans n8n

```
SUPABASE_URL=https://TON-PROJECT.supabase.co
SUPABASE_SERVICE_KEY=ta-service-role-key
WHATSAPP_API_TOKEN=ton-token-whatsapp-business
WHATSAPP_PHONE_ID=ton-phone-id
PATRONNE_WHATSAPP=+228XXXXXXXXX
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Workflow 1 — Nouvelle vente → WhatsApp patronne

**Déclencheur :** Webhook Supabase (Database Webhook sur INSERT dans `sales`)

**URL webhook n8n :** `https://ton-n8n.app/webhook/nouvelle-vente`

**Configuration Supabase :**
1. Supabase Dashboard → Database → Webhooks
2. Name: `on_sale_insert`
3. Table: `sales`, Event: `INSERT`
4. URL: `https://ton-n8n.app/webhook/nouvelle-vente`

**Payload reçu (automatique Supabase) :**
```json
{
  "type": "INSERT",
  "table": "sales",
  "record": {
    "id": "...",
    "shop_id": "...",
    "total_amount": 17500,
    "paid_amount": 17500,
    "credit_amount": 0,
    "date": "2026-05-13"
  }
}
```

**Message WhatsApp envoyé :**
```
🧾 *Nouvelle vente enregistrée*
Montant : 17 500 F
Encaissé : 17 500 F
Crédit : 0 F
Heure : 09:41

_Envoyé par BiZ-Up Africa_
```

**Nodes n8n :**
1. Webhook (POST)
2. Function (formater le message)
3. HTTP Request → WhatsApp Business API `POST /messages`

---

## Workflow 2 — Rapport quotidien 20h

**Déclencheur :** Cron `0 20 * * *` (tous les jours à 20h)

**Actions :**
1. HTTP Request → Supabase REST API : `GET /sales?date=eq.TODAY&select=*`
2. HTTP Request → Supabase REST API : `GET /clients?total_debt=gt.0`
3. HTTP Request → Supabase REST API : `GET /products?stock_quantity=lte.alert_threshold`
4. Function → calculer totaux
5. HTTP Request → WhatsApp Business API

**Message WhatsApp :**
```
📊 *Rapport du jour — BiZ-Up Africa*
Date : Mercredi 13 mai 2026

💰 Ventes : 12 transactions
✅ Encaissé : 87 500 F
📋 En crédit : 15 000 F

🚨 Alertes stock : 1 produit critique
💸 Impayés : 3 clients

Top produit : 🍅 Tomates (63 000 F)

_Rapport automatique BiZ-Up Africa_
```

---

## Workflow 3 — Alerte stock faible

**Déclencheur :** Webhook Supabase sur UPDATE dans `products` quand `stock_quantity <= alert_threshold`

**URL webhook n8n :** `https://ton-n8n.app/webhook/stock-alerte`

**Condition dans n8n :** `record.stock_quantity <= record.alert_threshold`

**Message WhatsApp :**
```
🚨 *Alerte stock critique*
Produit : Piments
Stock actuel : 3 caisses
Seuil alerte : 3 caisses

👉 Commander maintenant auprès de tes fournisseurs.

_BiZ-Up Africa — Alerte automatique_
```

---

## Workflow 4 — Rappel impayé (7 jours)

**Déclencheur :** Cron `0 9 * * *` (tous les matins à 9h)

**Actions :**
1. HTTP Request → `GET /sales?credit_amount=gt.0&date=lte.7-DAYS-AGO`
2. Pour chaque vente avec crédit non soldé → envoyer rappel

**Message WhatsApp :**
```
💰 *Rappel paiement*
Client : Ama Koffi
Dette : 27 500 F
Date de la vente : 6 mai 2026
(il y a 8 jours)

📞 Contact : +228 90 12 34 56

_BiZ-Up Africa — Rappel automatique_
```

---

## Workflow 5 — Alerte saisonnière

**Déclencheur :** Cron hebdomadaire `0 8 * * 1` (lundi matin)

**Actions :**
1. Vérifier si changement de saison dans les 30 prochains jours (logique dans Function node)
2. Si oui → envoyer alerte WhatsApp

**Message WhatsApp :**
```
📅 *Alerte saisonnière BiZ-Up Africa*
La saison sèche approche dans 3 semaines.

📈 Les prix tomates vont monter.
👉 Commander maintenant peut t'économiser 300-500 F/caisse.

Tes fournisseurs saison sèche :
• Amadou K. — 2 900 F/caisse ⭐⭐⭐⭐⭐
• Yusuf A. — 3 100 F/caisse ⭐⭐⭐

_BiZ-Up Africa — Intelligence saisonnière_
```

---

## Comment déployer n8n

### Option 1 — n8n Cloud (recommandé)
1. Aller sur n8n.io → créer un compte
2. Importer les workflows depuis ce dossier
3. Configurer les variables d'environnement

### Option 2 — Auto-hébergé (Railway/Render)
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=motdepasse \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

---

## API WhatsApp Business — Envoyer un message

```
POST https://graph.facebook.com/v18.0/{PHONE_ID}/messages
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "+228XXXXXXXXX",
  "type": "text",
  "text": { "body": "Votre message ici" }
}
```
