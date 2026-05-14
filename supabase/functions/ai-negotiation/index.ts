// Supabase Edge Function — Deno runtime
// @ts-nocheck
import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  const { supplier_name, product_name, price_history } = await req.json()

  if (!price_history || price_history.length === 0) {
    return Response.json({ advice: 'Pas encore d\'historique de prix pour ce fournisseur. Commence par enregistrer quelques achats.' })
  }

  const prices = price_history.map((h) => h.price_per_unit)
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const last = prices[0]
  const min = Math.min(...prices)
  const max = Math.max(...prices)

  const prompt = `Tu es un assistant de négociation commerciale pour les commerçantes en gros d'Afrique de l'Ouest.

Données fournisseur :
- Fournisseur : ${supplier_name}
- Produit : ${product_name}
- Historique des prix (du plus récent au plus ancien) : ${prices.join(', ')} FCFA/caisse
- Prix moyen historique : ${avg} FCFA
- Dernier prix payé : ${last} FCFA
- Prix minimum historique : ${min} FCFA
- Prix maximum historique : ${max} FCFA

Donne un conseil de négociation court (3-4 phrases maximum) en français simple, sans jargon. Dis :
1. Si le dernier prix est raisonnable ou non par rapport à l'historique
2. La fourchette de négociation conseillée
3. Un argument court à utiliser face au fournisseur

Réponds directement sans préambule.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const advice = message.content[0].text

  return Response.json({ advice }, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  })
})
