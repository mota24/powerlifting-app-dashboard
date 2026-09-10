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

/** Objectifs quotidiens. null = pas d'objectif pour cette mesure. */
export interface ObjectifsNutrition {
  kcal: number | null
  proteines: number | null
}

export const LIMITES_OBJECTIFS = { kcal: [800, 8000], proteines: [20, 400] } as const

/** Champ saisi : vide = pas d'objectif, entier = objectif, le reste est invalide. */
export function lireObjectif(saisie: string): number | null | 'invalide' {
  const brut = saisie.replace(/\s/g, '')
  if (brut === '') return null
  const n = Number(brut)
  return Number.isInteger(n) ? n : 'invalide'
}

export function objectifValide(valeur: number | null, [min, max]: readonly [number, number]): boolean {
  return valeur === null || (Number.isInteger(valeur) && valeur >= min && valeur <= max)
}

/** Repère courant pour la musculation : 1,6 à 2,2 g de protéines par kg, conseil vers 1,8 g arrondi à 5 g. */
export function repereProteines(poidsKg: number): { min: number; max: number; conseil: number } {
  return {
    min: Math.round(poidsKg * 1.6),
    max: Math.round(poidsKg * 2.2),
    conseil: Math.round((poidsKg * 1.8) / 5) * 5,
  }
}

/**
 * Où en est la journée : ce qui reste, ou le dépassement. Pour une mesure où
 * dépasser est une réussite (protéines), le dépassement compte comme « atteint ».
 */
export function etatObjectif(valeur: number, objectif: number, depasserReussit: boolean): { part: number; etat: 'reste' | 'atteint' | 'depasse'; ecart: number } {
  const ecart = Math.round(objectif - valeur)
  const part = objectif > 0 ? Math.min(1, Math.max(0, valeur / objectif)) : 0
  if (ecart > 0) return { part, etat: 'reste', ecart }
  if (ecart === 0 || depasserReussit) return { part, etat: 'atteint', ecart: 0 }
  return { part, etat: 'depasse', ecart: -ecart }
}

/** 1 kcal = 4,184 kJ. */
export const KJ_PAR_KCAL = 4.184

/** Fiche Open Food Facts trouvée mais sans calories ou protéines : de quoi pré-remplir la saisie. */
export interface ProduitPartiel {
  code: string
  nom: string | null
  marque: string | null
  portionG: number | null
}

/** Ligne de aliments_perso : produit saisi une fois par le compte, retrouvé au scan suivant. */
export interface AlimentPerso {
  code_barres: string
  nom: string
  marque: string | null
  kcal_100g: number
  proteines_100g: number
  portion_g: number | null
}

export function depuisAlimentPerso(a: AlimentPerso): Aliment {
  return {
    code: a.code_barres,
    nom: a.nom,
    marque: a.marque,
    // Number() : selon la configuration, PostgREST peut renvoyer un numeric en texte.
    kcal100: Number(a.kcal_100g),
    prot100: Number(a.proteines_100g),
    portionG: a.portion_g === null ? null : Number(a.portion_g),
  }
}

/** Un UPC-A (12 chiffres) est aussi un EAN-13 précédé d'un 0 : les deux écritures désignent le même produit. */
export function variantesCode(code: string): string[] {
  if (code.length === 12) return [code, `0${code}`]
  if (code.length === 13 && code.startsWith('0')) return [code, code.slice(1)]
  return [code]
}
