import { bestE1RM, classifyLift, type LiftCategory, type ModeApp, type SetData } from '@/lib/powerlifting'

/** Points ajoutés au classement pour une séance validée qui bat un record. */
export const POINTS_RECORD = 15

/** Profondeur de l'historique comparé : un an de séances. */
export const MOIS_HISTORIQUE_RECORDS = 12

export interface LigneHistorique { exercise_name: string | null; tracking_data: SetData[] | null }

/** Meilleur 1RM estimé par mouvement suivi, sur un ensemble de lignes. */
export function meilleursParMouvement(lignes: LigneHistorique[], mode: ModeApp): Partial<Record<LiftCategory, number>> {
  const meilleurs: Partial<Record<LiftCategory, number>> = {}
  for (const ligne of lignes) {
    const mouvement = classifyLift(ligne.exercise_name, mode)
    if (!mouvement) continue
    const valeur = bestE1RM(ligne.tracking_data)
    if (valeur > (meilleurs[mouvement] ?? 0)) meilleurs[mouvement] = valeur
  }
  return meilleurs
}

/**
 * Mouvements dont la séance du jour bat le meilleur 1RM estimé des séances
 * précédentes. Un mouvement jamais noté avant ne compte pas : noter son
 * premier hip thrust n'est pas battre un record.
 */
export function recordsBattus(duJour: LigneHistorique[], avant: LigneHistorique[], mode: ModeApp): LiftCategory[] {
  const aujourdhui = meilleursParMouvement(duJour, mode)
  const precedents = meilleursParMouvement(avant, mode)
  return (Object.keys(aujourdhui) as LiftCategory[]).filter((mouvement) => {
    const ancien = precedents[mouvement] ?? 0
    // Arrondi au kilo : 160,4 contre 160,2 n'est pas un record, juste du bruit de calcul.
    return ancien > 0 && Math.round(aujourdhui[mouvement] ?? 0) > Math.round(ancien)
  })
}
