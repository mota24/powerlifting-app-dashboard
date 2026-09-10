import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/server/auth-session'
import { clientIp } from '@/lib/server/rate-limit'
import { limiterMemoire } from '@/lib/server/memory-rate-limit'
import { KJ_PAR_KCAL, variantesCode, type Aliment, type ProduitPartiel } from '@/lib/nutrition'

export const dynamic = 'force-dynamic'

/**
 * Recherche d'aliments dans Open Food Facts (base ouverte, gratuite, sans clé).
 *
 * Passe par le serveur : la CSP n'autorise aucun appel du navigateur vers
 * l'extérieur (connect-src 'self') et on ne l'ouvre pas pour ça. Aucune donnée
 * personnelle n'est transmise, seulement le code-barres ou le texte cherché.
 */

// Chaque recherche tapée déclenche un appel : plafond généreux pour l'usage
// normal, mais qui protège le quota Vercel et la politesse envers Open Food Facts.
const LIMITE_PAR_MINUTE = 30
const DELAI_MS = 6000
// Open Food Facts demande que l'application appelante s'identifie.
const USER_AGENT = 'PowerApp/1.0'
const CHAMPS = 'code,product_name,product_name_fr,product_name_es,product_name_ca,brands,serving_quantity,nutriments'

// Les deux API d'Open Food Facts ne typent pas les champs pareil : `brands`
// est un texte « A, B » pour la fiche produit, mais un tableau dans le moteur
// de recherche. Tout est donc lu comme inconnu puis vérifié.
type ProduitOff = {
  code?: unknown
  product_name?: unknown
  product_name_fr?: unknown
  product_name_es?: unknown
  product_name_ca?: unknown
  brands?: unknown
  serving_quantity?: unknown
  nutriments?: Record<string, unknown>
}

function nombre(valeur: unknown): number | null {
  const n = typeof valeur === 'number' ? valeur : typeof valeur === 'string' ? Number.parseFloat(valeur) : Number.NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() ? valeur.trim() : null
}

function premiereMarque(brands: unknown): string | null {
  if (Array.isArray(brands)) return texte(brands[0])
  return texte(typeof brands === 'string' ? brands.split(',')[0] : null)
}

/** Ce qu'une fiche apprend du produit, complet ou non. */
interface Extrait {
  code: string | null
  nom: string | null
  marque: string | null
  kcal: number | null
  prot: number | null
  portionG: number | null
}

function extraire(p: ProduitOff, langue: 'fr' | 'es'): Extrait {
  const nutriments = p.nutriments ?? {}
  // Beaucoup de fiches n'ont que l'énergie en kJ (energy_100g est en kJ) : on la convertit.
  const kj = nombre(nutriments['energy-kj_100g']) ?? nombre(nutriments['energy_100g'])
  const kcal = nombre(nutriments['energy-kcal_100g']) ?? (kj !== null ? kj / KJ_PAR_KCAL : null)
  const noms = langue === 'es'
    ? [p.product_name_es, p.product_name, p.product_name_ca, p.product_name_fr]
    : [p.product_name_fr, p.product_name, p.product_name_es, p.product_name_ca]
  const nom = noms.map(texte).find((n): n is string => n !== null) ?? null
  const portion = nombre(p.serving_quantity)
  const code = texte(p.code)
  return {
    code: code && /^\d{6,14}$/.test(code) ? code : null,
    nom: nom ? nom.slice(0, 200) : null,
    marque: premiereMarque(p.brands)?.slice(0, 200) ?? null,
    kcal,
    prot: nombre(nutriments['proteins_100g']),
    portionG: portion !== null && portion > 0 && portion <= 5000 ? portion : null,
  }
}

function versAliment(e: Extrait): Aliment | null {
  // Sans calories ou sans protéines, un produit est inutilisable dans le journal.
  if (e.kcal === null || e.prot === null || e.kcal > 1000 || e.prot > 100 || !e.nom) return null
  return {
    code: e.code,
    nom: e.nom,
    marque: e.marque,
    kcal100: Math.round(e.kcal * 10) / 10,
    prot100: Math.round(e.prot * 10) / 10,
    portionG: e.portionG,
  }
}

async function appelerOff(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(DELAI_MS), cache: 'no-store' })
}

export async function GET(req: NextRequest) {
  const verdict = limiterMemoire(`aliments:${clientIp(req)}`, LIMITE_PAR_MINUTE, 60_000)
  if (verdict.bloque) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } })
  }

  const auth = await getAccessToken(req)
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const params = req.nextUrl.searchParams
  // 'ca' : ancienne langue du compte 2, encore envoyée par un onglet resté ouvert.
  const lang = params.get('lang')
  const langue = lang === 'es' || lang === 'ca' ? 'es' : 'fr'
  const code = params.get('code')?.trim()
  const recherche = params.get('q')?.trim()

  try {
    if (code) {
      if (!/^\d{6,14}$/.test(code)) return NextResponse.json({ error: 'Code invalide' }, { status: 400 })
      let partiel: ProduitPartiel | null = null
      // Un même produit peut être enregistré en UPC (12 chiffres) ou en EAN-13 (précédé d'un 0).
      for (const variante of variantesCode(code)) {
        const rep = await appelerOff(`https://world.openfoodfacts.org/api/v2/product/${variante}.json?fields=${CHAMPS}`)
        if (!rep.ok && rep.status !== 404) return NextResponse.json({ error: 'Service indisponible' }, { status: 502 })
        // Code inconnu : Open Food Facts répond status = 0 (en 200 ou en 404 selon les cas).
        const corps = rep.ok ? ((await rep.json()) as { status?: number; product?: ProduitOff }) : null
        if (corps?.status !== 1 || !corps.product) continue
        const extrait = extraire({ ...corps.product, code }, langue)
        const aliment = versAliment(extrait)
        if (aliment) return NextResponse.json({ aliments: [aliment] }, { headers: { 'Cache-Control': 'private, max-age=86400' } })
        // Fiche trouvée mais incomplète : le nom connu servira à pré-remplir la saisie.
        partiel ??= { code, nom: extrait.nom, marque: extrait.marque, portionG: extrait.portionG }
      }
      return NextResponse.json({ aliments: [], partiel }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
    }

    if (recherche) {
      if (recherche.length < 2 || recherche.length > 80) return NextResponse.json({ error: 'Recherche invalide' }, { status: 400 })
      // Nouveau moteur de recherche : l'ancien (cgi/search.pl) répond 503 aux appels automatisés.
      const rep = await appelerOff(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(recherche)}&page_size=25&fields=${CHAMPS}`)
      if (!rep.ok) return NextResponse.json({ error: 'Service indisponible' }, { status: 502 })
      const corps = (await rep.json()) as { hits?: ProduitOff[]; products?: ProduitOff[] }
      const aliments = (corps.hits ?? corps.products ?? [])
        .map((p) => versAliment(extraire(p, langue)))
        .filter((a): a is Aliment => a !== null)
        .slice(0, 15)
      return NextResponse.json({ aliments }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
    }

    return NextResponse.json({ error: 'Paramètre code ou q requis' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 })
  }
}
