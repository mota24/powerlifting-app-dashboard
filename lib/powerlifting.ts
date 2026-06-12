// Logique métier Powerlifting

/** Formule d'Epley : 1RM = poids * (1 + reps / 30) */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Arrondi au demi-kilo le plus proche */
export function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2
}

// Disques disponibles (kg) avec couleurs normes IPF
export const PLATES: { weight: number; color: string; label: string }[] = [
  { weight: 25, color: 'oklch(0.62 0.23 25)', label: '25' },
  { weight: 20, color: 'oklch(0.55 0.18 250)', label: '20' },
  { weight: 15, color: 'oklch(0.78 0.16 75)', label: '15' },
  { weight: 10, color: 'oklch(0.7 0.18 150)', label: '10' },
  { weight: 5, color: 'oklch(0.96 0.005 240)', label: '5' },
  { weight: 2.5, color: 'oklch(0.5 0.02 250)', label: '2.5' },
  { weight: 1.25, color: 'oklch(0.72 0.04 250)', label: '1.25' },
]

export const BAR_WEIGHT = 20

/**
 * Calcule les disques à charger de CHAQUE côté de la barre.
 */
export function computePlates(target: number, bar = BAR_WEIGHT) {
  const perSide = (target - bar) / 2
  const result: { weight: number; color: string; label: string }[] = []
  if (perSide <= 0) {
    return { plates: result, perSide: 0, achievable: target === bar, remainder: 0 }
  }
  let remaining = perSide
  for (const plate of PLATES) {
    while (remaining + 1e-9 >= plate.weight) {
      result.push(plate)
      remaining = Math.round((remaining - plate.weight) * 100) / 100
    }
  }
  return {
    plates: result,
    perSide,
    achievable: remaining < 1e-9,
    remainder: remaining,
  }
}

/**
 * Génère les paliers d'échauffement progressifs vers un top set.
 * Pourcentages classiques : barre, 40, 55, 70, 80, 90%.
 */
export function generateWarmup(topSet: number) {
  const steps = [
    { pct: 0, reps: 8, label: 'Barre à vide' },
    { pct: 0.4, reps: 5, label: 'Activation' },
    { pct: 0.55, reps: 5, label: 'Montée' },
    { pct: 0.7, reps: 3, label: 'Montée' },
    { pct: 0.8, reps: 2, label: 'Pré-top' },
    { pct: 0.9, reps: 1, label: 'Dernier saut' },
  ]
  return steps.map((s, i) => {
    const raw = s.pct === 0 ? BAR_WEIGHT : topSet * s.pct
    return {
      id: i,
      weight: roundToHalf(Math.max(BAR_WEIGHT, raw)),
      reps: s.reps,
      pct: Math.round(s.pct * 100),
      label: s.label,
    }
  })
}

export type Exercise = {
  id: string
  name: string
  variant: string
  variantFactor: number // multiplicateur de charge cible
}

export const EXERCISES: Record<string, { base: string; variant: string }> = {
  squat: { base: 'Back Squat', variant: 'Front Squat' },
  bench: { base: 'Bench Press', variant: 'Larsen Press' },
  deadlift: { base: 'Deadlift', variant: 'Deficit Deadlift' },
  ohp: { base: 'Overhead Press', variant: 'Push Press' },
}
