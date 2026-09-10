import type { CleTraduction } from './i18n'
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

/**
 * Disques d'une salle de musculation classique (Basic-Fit, Fitness Park…) :
 * pas de 25 kg, qu'on ne trouve guère que sur du matériel de powerlifting.
 */
export const PLATES_FITNESS = PLATES.filter((p) => p.weight <= 20)

export const BAR_WEIGHT = 20

/** Stop-disque de compétition (IPF) : 2,5 kg chacun, compté dans la charge. */
export const COLLAR_WEIGHT = 2.5

/**
 * Arrondit à la charge réellement chargeable la plus proche.
 * La plus petite paire de disques étant 2×1.25 kg, le pas réel d'une barre est 2.5 kg.
 */
export function roundToLoadable(target: number, increment = 2.5, bar = BAR_WEIGHT): number {
  if (target <= bar) return bar
  return bar + Math.round((target - bar) / increment) * increment
}

/**
 * Calcule les disques à charger de CHAQUE côté de la barre, avec le jeu de
 * disques disponible. `collier` est le poids d'UN stop-disque : 0 en salle,
 * où ils ne pèsent que quelques grammes.
 */
export function computePlates(target: number, bar = BAR_WEIGHT, disques = PLATES, collier = 0) {
  const perSide = (target - bar - 2 * collier) / 2
  const result: { weight: number; color: string; label: string }[] = []
  if (perSide <= 0) {
    return { plates: result, perSide: 0, achievable: target === bar + 2 * collier, remainder: 0 }
  }
  let remaining = perSide
  for (const plate of disques) {
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
  const steps: { pct: number; reps: number; cle: CleTraduction }[] = [
    { pct: 0, reps: 8, cle: 'echBarreVide' },
    { pct: 0.4, reps: 5, cle: 'echActivation' },
    { pct: 0.55, reps: 5, cle: 'echMontee' },
    { pct: 0.7, reps: 3, cle: 'echMontee' },
    { pct: 0.8, reps: 2, cle: 'echPreTop' },
    { pct: 0.9, reps: 1, cle: 'echDernierSaut' },
  ]
  return steps.map((s, i) => {
    const raw = s.pct === 0 ? BAR_WEIGHT : topSet * s.pct
    return {
      id: i,
      weight: roundToLoadable(Math.max(BAR_WEIGHT, raw)),
      reps: s.reps,
      pct: Math.round(s.pct * 100),
      cle: s.cle,
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

// ————————————————————————————————————————————————
// Catalogue FITNESS (salle, sans compétition) — compte en mode 'fitness'.
// En espagnol : ce catalogue ne sert qu'au compte d'Yamina, et ces noms
// sont ceux qu'elle voit dans l'autocomplétion puis qui sont écrits en base.
// Les trois mouvements suivis en Analytique ouvrent la liste des jambes.
// ————————————————————————————————————————————————

export const FIT_JAMBES = ['Squat', 'Hip Thrust', 'Peso muerto rumano', 'Prensa de piernas', 'Extensión de cuádriceps', 'Curl femoral', 'Zancadas con mancuernas', 'Sentadilla búlgara', 'Abductores en máquina', 'Aductores en máquina', 'Gemelos de pie', 'Subidas al banco', 'Patada de glúteo en polea']
export const FIT_POUSSEE = ['Press de banca con mancuernas', 'Press de pecho en máquina', 'Press inclinado con mancuernas', 'Aperturas en polea', 'Contractora (Pec Deck)', 'Press de hombros en máquina', 'Elevaciones laterales', 'Extensión de tríceps en polea', 'Fondos asistidos']
export const FIT_TIRAGE = ['Jalón al pecho', 'Remo en máquina', 'Remo bajo en polea', 'Remo con mancuerna', 'Face Pull', 'Curl de bíceps con mancuernas', 'Curl Scott', 'Dominadas asistidas']
export const FIT_ACCESSOIRES = ['Plancha', 'Crunch en polea', 'Elevación de piernas', 'Abdominales en máquina', 'Russian Twist', 'Bicicleta', 'Cinta de correr', 'Remo (ergómetro)', 'Elíptica', 'Estiramientos', 'Movilidad de cadera']

export type LiftCategory = 'squat' | 'bench' | 'deadlift'
export type ModeApp = 'powerlifting' | 'fitness'

/**
 * Les trois catégories suivies, par mode. On réutilise volontairement
 * les mêmes clés ('squat' | 'bench' | 'deadlift') dans les deux modes :
 * ce sont des identifiants internes, pas des libellés. Ça évite de
 * toucher au schéma et à toute la machinerie de stats/graphiques, seul
 * l'affichage change.
 */
export const CATEGORIES_PAR_MODE: Record<ModeApp, { key: LiftCategory; cle: CleTraduction; court: string }[]> = {
  powerlifting: [
    { key: 'squat', cle: 'catSquat', court: 'SQ' },
    { key: 'bench', cle: 'catBench', court: 'BP' },
    { key: 'deadlift', cle: 'catDeadlift', court: 'DL' },
  ],
  fitness: [
    { key: 'squat', cle: 'catSquat', court: 'SQ' },
    { key: 'bench', cle: 'catHipThrust', court: 'HT' },
    { key: 'deadlift', cle: 'catPesMortRomanes', court: 'RDL' },
  ],
}

/** Suggestions d'exercices du jour, par mode et par jour de semaine. */
export function suggestionsExercices(mode: ModeApp, jourSemaine: number): string[] {
  if (mode === 'fitness') {
    switch (jourSemaine) {
      case 1: return [...FIT_JAMBES, ...FIT_ACCESSOIRES]
      case 2: return [...FIT_POUSSEE, ...FIT_ACCESSOIRES]
      case 3: return [...FIT_TIRAGE, ...FIT_ACCESSOIRES]
      case 4: return [...FIT_JAMBES, ...FIT_POUSSEE, ...FIT_ACCESSOIRES]
      case 6: return [...FIT_POUSSEE, ...FIT_TIRAGE, ...FIT_ACCESSOIRES]
      default: return [...FIT_JAMBES, ...FIT_POUSSEE, ...FIT_TIRAGE, ...FIT_ACCESSOIRES]
    }
  }
  switch (jourSemaine) {
    case 1: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]
    case 2: return [...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
    case 3: return [...LIFT_SQUAT, ...LIFT_BENCH, ...ACCESSORIES]
    case 4: return [...LIFT_BENCH, ...ACCESSORIES]
    case 6: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT]
    default: return [...LIFT_SQUAT, ...LIFT_BENCH, ...LIFT_DEADLIFT, ...ACCESSORIES]
  }
}

/**
 * Classe un nom d'exercice libre dans une des trois catégories suivies.
 * En mode fitness, les trois catégories sont trois mouvements précis
 * (squat, hip thrust, soulevé de terre roumain), pas des groupes
 * musculaires : un squat bulgare ou une presse ne doivent donc PAS gonfler
 * la courbe du squat. Les mots-clés couvrent espagnol, catalan (anciens noms), français et
 * anglais, puisque le nom est saisi librement.
 */
export function classifyLift(name: string | null | undefined, mode: ModeApp = 'powerlifting'): LiftCategory | null {
  if (!name) return null
  const n = name.toLowerCase()

  if (mode === 'fitness') {
    if (['rdl', 'romanès', 'romanes', 'rumano', 'roumain', 'romanian', 'jambes tendues', 'cames rígides', 'piernas rígidas'].some((k) => n.includes(k))) return 'deadlift'
    if (['hip thrust', 'hip-thrust', 'hipthrust', 'empenta de maluc', 'empuje de cadera'].some((k) => n.includes(k))) return 'bench'
    if (['squat', 'sentadilla', 'esquat'].some((k) => n.includes(k)) && !['split', 'bulgar', 'búlgar', 'bulgarian'].some((k) => n.includes(k))) return 'squat'
    return null
  }

  if (n.includes('squat') && !n.includes('split')) return 'squat'
  if (['bench', 'spoto', 'larsen'].some((k) => n.includes(k))) return 'bench'
  if (['deadlift', 'rdl', 'block pull'].some((k) => n.includes(k))) return 'deadlift'
  return null
}

// ————————————————————————————————————————————————
// Drapeau douleur (suivi de désensibilisation — rééducation)
// ————————————————————————————————————————————————

export const PAIN_LEVELS: { value: number; cle: CleTraduction; emoji: string }[] = [
  { value: 0, cle: 'douleurOk', emoji: '🟢' },
  { value: 1, cle: 'douleurGene', emoji: '🟡' },
  { value: 2, cle: 'douleurDouleur', emoji: '🟠' },
  { value: 3, cle: 'douleurStop', emoji: '🔴' },
]

export function painLabel(level: number | null | undefined, t: (cle: CleTraduction) => string): string | null {
  const p = PAIN_LEVELS.find((l) => l.value === level)
  return p ? `${p.emoji} ${t(p.cle)}` : null
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
