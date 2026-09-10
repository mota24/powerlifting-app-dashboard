/** Produit tel que renvoyé par /api/aliments, ou saisi à la main. Valeurs pour 100 g. */
export interface Aliment {
  code: string | null
  nom: string
  marque: string | null
  kcal100: number
  prot100: number
  /** Portion déclarée par le fabricant, en grammes. */
  portionG: number | null
  /** Quantité proposée d'office : la dernière utilisée, pour un aliment récent. */
  grammesParDefaut?: number
}

/** Ligne de la table journal_alimentaire. */
export interface EntreeJournal {
  id: string
  date: string
  nom: string
  marque: string | null
  code_barres: string | null
  grammes: number
  kcal_100g: number
  proteines_100g: number
  cree_le?: string
}

export const GRAMMES_MAX = 5000

export const grammesValides = (grammes: number) => Number.isFinite(grammes) && grammes > 0 && grammes <= GRAMMES_MAX

export const pourGrammes = (valeurPour100g: number, grammes: number) => (valeurPour100g * grammes) / 100

export function totauxDuJour(entrees: EntreeJournal[]): { kcal: number; prot: number } {
  return entrees.reduce(
    (totaux, e) => ({
      // Number() : selon la configuration, PostgREST peut renvoyer un numeric en texte.
      kcal: totaux.kcal + pourGrammes(Number(e.kcal_100g), Number(e.grammes)),
      prot: totaux.prot + pourGrammes(Number(e.proteines_100g), Number(e.grammes)),
    }),
    { kcal: 0, prot: 0 }
  )
}

/**
 * Aliments récents, du plus récent au plus ancien, sans doublon : même
 * code-barres, ou à défaut même nom sans tenir compte de la casse.
 * Les entrées doivent déjà être triées du plus récent au plus ancien.
 */
export function recents(entrees: EntreeJournal[], max = 12): Aliment[] {
  const vus = new Set<string>()
  const liste: Aliment[] = []
  for (const e of entrees) {
    const cle = e.code_barres ?? e.nom.trim().toLowerCase()
    if (vus.has(cle)) continue
    vus.add(cle)
    liste.push({
      code: e.code_barres,
      nom: e.nom,
      marque: e.marque,
      kcal100: Number(e.kcal_100g),
      prot100: Number(e.proteines_100g),
      portionG: null,
      grammesParDefaut: Number(e.grammes),
    })
    if (liste.length >= max) break
  }
  return liste
}
