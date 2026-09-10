import type { SetData } from '@/lib/powerlifting'

/**
 * Progression suggérée (mode muscu) : si toutes les séries prescrites de la
 * dernière séance ont été réussies (reps ET poids atteints), on propose une
 * petite charge en plus la fois suivante. Une règle simple, sans IA.
 */

export interface SeanceExercice {
  coach: SetData[]
  fait: SetData[]
}

export interface Suggestion {
  poids: number
  ancien: number
}

const nombre = (valeur: string | undefined) => {
  const n = Number.parseFloat((valeur ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}

/** Même exercice malgré la casse ou les espaces autour du nom. */
export const cleExercice = (nom: string) => nom.trim().toLocaleLowerCase()

/** La série a-t-elle un plan exploitable (reps et poids) ? */
export const seriePrescrite = (s: SetData | undefined) => nombre(s?.reps) > 0 && nombre(s?.weight) > 0

/** Petite charge suivante : +1 kg sous 10 kg (haltères légers), +2,5 kg au-delà, au demi-kilo près. */
export function chargeSuivante(poids: number): number {
  return Math.round((poids + (poids < 10 ? 1 : 2.5)) * 2) / 2
}

export function suggererProgression(precedente: SeanceExercice | undefined, planDuJour: SetData[]): Suggestion | null {
  if (!precedente) return null
  const series = precedente.coach
    .map((s, i) => ({ reps: nombre(s?.reps), poids: nombre(s?.weight), fait: precedente.fait[i] }))
    .filter((s) => s.reps > 0 && s.poids > 0)
  if (series.length === 0) return null
  const toutReussi = series.every(({ reps, poids, fait }) => nombre(fait?.reps) >= reps && nombre(fait?.weight) >= poids)
  if (!toutReussi) return null
  const ancien = Math.max(...series.map((s) => s.poids))
  // Charge déjà montée dans le plan du jour : plus rien à suggérer.
  if (planDuJour.some((s) => nombre(s?.weight) > ancien)) return null
  return { poids: chargeSuivante(ancien), ancien }
}
