// Logique métier Powerlifting

/**
 * Date locale au format YYYY-MM-DD.
 * À utiliser à la place de toISOString().split('T')[0] qui bascule
 * sur le jour précédent entre minuit et 1h/2h du matin (UTC+1/+2).
 */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
 * Arrondit à la charge réellement chargeable la plus proche.
 * La plus petite paire de disques étant 2×1.25 kg, le pas réel d'une barre est 2.5 kg.
 */
export function roundToLoadable(target: number, increment = 2.5, bar = BAR_WEIGHT): number {
  if (target <= bar) return bar
  return bar + Math.round((target - bar) / increment) * increment
}

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
 * Chaque palier est arrondi à une charge réellement chargeable (pas de 2.5 kg).
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
      weight: roundToLoadable(Math.max(BAR_WEIGHT, raw)),
      reps: s.reps,
      pct: Math.round(s.pct * 100),
      label: s.label,
    }
  })
}

// ————————————————————————————————————————————————
// Séries, tonnage et estimation de 1RM
// ————————————————————————————————————————————————

/** Une série saisie dans le formulaire (champs texte libres) */
export type SetData = { reps: string; weight: string; rpe: string }

/**
 * Additionne les reps même saisies en format libre "3/4/5" ou "3+2"
 * (notation d'un trait autorisée par les champs texte du formulaire).
 */
export function parseNumericReps(input: string): number {
  if (!input) return 0
  return input.split(/[\/+]/).reduce((sum, part) => {
    const n = parseInt(part.trim(), 10)
    return Number.isFinite(n) ? sum + n : sum
  }, 0)
}

/** Tonnage d'une liste de séries (Σ poids × reps), en kg */
export function setsTonnage(sets: SetData[] | null | undefined): number {
  if (!Array.isArray(sets)) return 0
  let total = 0
  for (const set of sets) {
    const w = parseFloat(set?.weight)
    const r = parseNumericReps(set?.reps ?? '')
    if (w > 0 && r > 0) total += w * r
  }
  return total
}

/** Tonnage total d'une séance (toutes les séries validées par l'athlète) */
export function sessionTonnage(exercices: { tracking: SetData[] }[]): number {
  return Math.round(exercices.reduce((sum, ex) => sum + setsTonnage(ex.tracking), 0))
}

/**
 * 1RM estimé : moyenne Epley/Brzycki avec correction RPE (RIR).
 * RPE absent ou invalide → 10 (échec total).
 */
export function averageE1RM(weight: number, reps: number, rpe = 10): number {
  if (!(weight > 0) || !(reps > 0)) return 0
  const rpeVal = Number.isFinite(rpe) ? Math.min(10, Math.max(4, rpe)) : 10
  const effectiveReps = reps + (10 - rpeVal)
  if (effectiveReps <= 1) return weight
  // Brzycki diverge quand effectiveReps approche 37 : on borne
  if (effectiveReps >= 30) return weight * 2
  const epley = weight * (1 + effectiveReps / 30)
  const brzycki = weight * (36 / (37 - effectiveReps))
  return (epley + brzycki) / 2
}

/**
 * 1RM estimé d'UNE série saisie (poids + reps requis, RPE optionnel → 10).
 * Pour la notation libre "3/4/5" (plusieurs passages sur une ligne), on prend
 * le MEILLEUR passage : sommer les reps (correct pour le tonnage) gonflerait
 * artificiellement l'estimation.
 */
export function setE1RM(set: SetData | null | undefined): number {
  if (!set) return 0
  const weight = parseFloat(set.weight)
  if (!(weight > 0)) return 0
  const passages = (set.reps ?? '')
    .split(/[\/+]/)
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (passages.length === 0) return 0
  const reps = Math.max(...passages)
  const rpe = parseFloat(set.rpe)
  return averageE1RM(weight, reps, Number.isFinite(rpe) ? rpe : 10)
}

/** Meilleur 1RM estimé d'une liste de séries (0 si aucune série exploitable) */
export function bestE1RM(sets: SetData[] | null | undefined): number {
  if (!Array.isArray(sets)) return 0
  return sets.reduce((best, set) => Math.max(best, setE1RM(set)), 0)
}

// ————————————————————————————————————————————————
// Catalogue d'exercices — SOURCE UNIQUE pour toute l'app
// ————————————————————————————————————————————————

export const LIFT_SQUAT = ['Back Squat', 'Paused Squat', 'Front Squat', 'Tempo Squat', 'Pin Squat']
export const LIFT_BENCH = ['Bench Press', 'Paused Bench', 'Close Grip Bench', 'Incline Bench', 'Spoto Press', 'Larsen Press']
export const LIFT_DEADLIFT = ['Deadlift', 'Sumo Deadlift', 'Deficit Deadlift', 'Paused Deadlift', 'RDL', 'Block Pulls']
export const ACCESSORIES = ['Pull-ups', 'Barbell Row', 'Lat Pulldown', 'Leg Press', 'Bulgarian Split Squat', 'Leg Extensions', 'Leg Curls', 'Bicep Curls', 'Tricep Extensions', 'Gainage (Planche)', 'Ab Rollout']

export type LiftCategory = 'squat' | 'bench' | 'deadlift'

/** Classe un nom d'exercice libre dans une catégorie SBD (ou null si accessoire) */
export function classifyLift(name: string | null | undefined): LiftCategory | null {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('squat') && !n.includes('split')) return 'squat'
  if (['bench', 'spoto', 'larsen'].some((k) => n.includes(k))) return 'bench'
  if (['deadlift', 'rdl', 'block pull'].some((k) => n.includes(k))) return 'deadlift'
  return null
}

// ————————————————————————————————————————————————
// Drapeau douleur (suivi de désensibilisation — rééducation)
// ————————————————————————————————————————————————

export const PAIN_LEVELS = [
  { value: 0, label: 'OK', emoji: '🟢' },
  { value: 1, label: 'Gêne', emoji: '🟡' },
  { value: 2, label: 'Douleur', emoji: '🟠' },
  { value: 3, label: 'Stop', emoji: '🔴' },
] as const

export function painLabel(level: number | null | undefined): string | null {
  const p = PAIN_LEVELS.find((l) => l.value === level)
  return p ? `${p.emoji} ${p.label}` : null
}

// ————————————————————————————————————————————————
// Score IPF GL — coefficients officiels IPF (mai 2020 à déc. 2023),
// Powerlifting Classique. Source unique : ne pas dupliquer ces
// constantes ailleurs (une coquille sur B a déjà faussé les scores).
// https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf
// ————————————————————————————————————————————————

const IPF_GL_COEFFICIENTS = {
  male: { A: 1199.72839, B: 1025.18162, C: 0.00921 },
  female: { A: 610.32796, B: 1045.59282, C: 0.03048 },
} as const

export function calculateIPFGL(total: number, bodyweight: number, gender: 'male' | 'female' = 'male'): number {
  if (!(total > 0) || !(bodyweight > 0)) return 0
  const { A, B, C } = IPF_GL_COEFFICIENTS[gender]
  const denom = A - B * Math.exp(-C * bodyweight)
  return denom > 0 ? (100 * total) / denom : 0
}

// ————————————————————————————————————————————————
// Peaking : décompte vers la prochaine compétition
// ————————————————————————————————————————————————

/** Le strict nécessaire pour le décompte de peaking (issu de `competitions`). */
export interface UpcomingCompetition {
  id: string
  name: string
  date: string // 'YYYY-MM-DD'
  level: string | null
  country_code: string | null
}

function parseLocalDateStr(dateStr: string): Date {
  const [annee, mois, jour] = dateStr.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}

/**
 * Semaines pleines séparant deux dates locales 'YYYY-MM-DD' (0 si `target`
 * est déjà passée par rapport à `from`, ou tombe le jour même). Arrondi au
 * SUPÉRIEUR : à J-1..J-7 de la compétition, on est encore dans "S-1" — la
 * dernière semaine ne devient "S0" qu'au jour J lui-même.
 */
export function weeksOut(fromDateStr: string, targetDateStr: string): number {
  const diffJours = Math.round((parseLocalDateStr(targetDateStr).getTime() - parseLocalDateStr(fromDateStr).getTime()) / 86_400_000)
  return diffJours > 0 ? Math.ceil(diffJours / 7) : 0
}
