import { parseLocalDate, toLocalDateStr } from '@/lib/powerlifting'

/** Une ligne renvoyée par la fonction SQL classement_mois : uniquement des totaux. */
export interface LigneClassement {
  /** Premier jour du mois, 'YYYY-MM-DD'. */
  mois: string
  /** Premier jour réellement compté (le classement démarre en cours de mois). */
  depuis: string
  prenom: string
  est_moi: boolean
  points: number
  pts_pas: number
  pts_seances: number
  pts_objectif: number
  pts_serie: number
  jours_8000: number
  seances: number
  /** Semaines du mois où l'objectif de 3 séances est atteint, sur les semaines comptées. */
  objectif_fait: number
  objectif_semaines: number
  objectif_atteint: boolean
  serie: number
  niveau: number
  streak: number
}

export type LigneRangee = LigneClassement & { rang: number }
export type MoisClasse = { mois: string; depuis: string; lignes: LigneRangee[] }

/** Rang « olympique » : deux scores égaux partagent la même place. */
export function ranger(lignes: LigneClassement[]): LigneRangee[] {
  return lignes
    .map((ligne) => ({ ...ligne, rang: 1 + lignes.filter((autre) => autre.points > ligne.points).length }))
    .sort((a, b) => a.rang - b.rang || a.prenom.localeCompare(b.prenom))
}

/** Du mois le plus récent au plus ancien. */
export function grouperParMois(lignes: LigneClassement[]): MoisClasse[] {
  const parMois = new Map<string, LigneClassement[]>()
  for (const ligne of lignes) {
    const liste = parMois.get(ligne.mois) ?? []
    liste.push(ligne)
    parMois.set(ligne.mois, liste)
  }
  return [...parMois.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([mois, groupe]) => ({ mois, depuis: groupe[0]?.depuis ?? mois, lignes: ranger(groupe) }))
}

/**
 * Palmarès : un mois n'est compté que s'il a rapporté des points à quelqu'un,
 * sinon il n'a pas été joué (ni vainqueur, ni égalité).
 */
export function palmares(mois: MoisClasse[], joueurs: string[]): { victoires: Map<string, number>; egalites: number; joues: MoisClasse[] } {
  const joues = mois.filter((m) => m.lignes.some((ligne) => ligne.points > 0))
  const victoires = new Map<string, number>(joueurs.map((prenom) => [prenom, 0]))
  let egalites = 0
  for (const m of joues) {
    const gagnants = m.lignes.filter((ligne) => ligne.rang === 1)
    if (gagnants.length === 1) victoires.set(gagnants[0].prenom, (victoires.get(gagnants[0].prenom) ?? 0) + 1)
    else egalites++
  }
  return { victoires, egalites, joues }
}

/** Jours restants dans le mois, aujourd'hui compris (1 = dernier jour). */
export function joursRestants(mois: string, aujourdhui: Date): number {
  const debut = parseLocalDate(mois)
  const finDuMois = new Date(debut.getFullYear(), debut.getMonth() + 1, 0)
  if (toLocalDateStr(aujourdhui) > toLocalDateStr(finDuMois)) return 0
  const jours = Math.round((finDuMois.getTime() - parseLocalDate(toLocalDateStr(aujourdhui)).getTime()) / 86_400_000)
  return Math.max(0, jours) + 1
}

/** Dernier jour du mois : le classement se clôt ce soir-là. */
export const estDernierJourDuMois = (date = new Date()) =>
  date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

/** Libellé du mois dans la langue du profil, première lettre en majuscule. */
export function libelleMois(mois: string, locale: string): string {
  const texte = parseLocalDate(mois).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}
