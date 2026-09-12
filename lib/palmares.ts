import { calculateIPFGL, toLocalDateStr } from '@/lib/powerlifting'

// ————————————————————————————————————————————————
// Modèle
//
// Les essais suivent la convention OpenPowerlifting : valeur positive =
// essai validé, valeur négative = essai manqué, null = non tenté.
// ————————————————————————————————————————————————

export type LiftKey = 'squat' | 'bench' | 'deadlift'

export const LIFTS: { key: LiftKey; label: string; short: string }[] = [
  { key: 'squat', label: 'Squat', short: 'SQ' },
  { key: 'bench', label: 'Dév. Couché', short: 'BP' },
  { key: 'deadlift', label: 'S. de Terre', short: 'DL' },
]

/** Niveaux proposés en autocomplétion — le champ reste libre. */
export const NIVEAUX = ['Régional', 'AEP 1', 'AEP 2', 'National', 'International']

export type VueMode = 'cartes' | 'tableau'

export interface Competition {
  id: string
  name: string
  date: string
  category: string | null
  level: string | null
  /** Code ISO 3166-1 alpha-2 ; le drapeau en est dérivé à l'affichage. */
  country_code: string | null
  placement: number | null
  /** Rediffusion / live de la compétition (YouTube ou autre). */
  video_url: string | null
  bodyweight: number | null
  squat: number | null
  bench: number | null
  deadlift: number | null
  squat_1: number | null
  squat_2: number | null
  squat_3: number | null
  bench_1: number | null
  bench_2: number | null
  bench_3: number | null
  deadlift_1: number | null
  deadlift_2: number | null
  deadlift_3: number | null
  photo_urls: string[] | null
}

export type Attempt = number | null

/** Les 3 essais d'un mouvement, dans l'ordre de passage. */
export function attemptsOf(comp: Competition, lift: LiftKey): Attempt[] {
  switch (lift) {
    case 'squat':
      return [comp.squat_1, comp.squat_2, comp.squat_3]
    case 'bench':
      return [comp.bench_1, comp.bench_2, comp.bench_3]
    case 'deadlift':
      return [comp.deadlift_1, comp.deadlift_2, comp.deadlift_3]
  }
}

export function storedBest(comp: Competition, lift: LiftKey): number | null {
  switch (lift) {
    case 'squat':
      return comp.squat
    case 'bench':
      return comp.bench
    case 'deadlift':
      return comp.deadlift
  }
}

/** Meilleure barre validée d'une série d'essais (0 si aucune réussie). */
export function bestValid(attempts: Attempt[]): number {
  return attempts.reduce<number>((best, a) => (a != null && a > best ? a : best), 0)
}

/**
 * Meilleure barre du mouvement : dérivée des essais dès qu'au moins un est
 * saisi (source de vérité), sinon la valeur enregistrée seule.
 */
export function bestLift(comp: Competition, lift: LiftKey): number {
  const fromAttempts = bestValid(attemptsOf(comp, lift))
  if (fromAttempts > 0) return fromAttempts
  const stored = storedBest(comp, lift)
  return stored != null && stored > 0 ? stored : 0
}

export function totalOf(comp: Competition): number {
  return LIFTS.reduce((sum, l) => sum + bestLift(comp, l.key), 0)
}

export function glOf(comp: Competition): number {
  const total = totalOf(comp)
  return total > 0 && comp.bodyweight ? calculateIPFGL(total, comp.bodyweight) : 0
}

export function todayStr(): string {
  return toLocalDateStr(new Date())
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatPlacement(placement: number): string {
  return placement === 1 ? '1er' : `${placement}e`
}

/** Affichage d'un poids : décimale seulement si utile (167,5 mais 295). */
export function formatKg(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

// ————————————————————————————————————————————————
// Formulaire
// ————————————————————————————————————————————————

export interface FormState {
  name: string
  date: string
  category: string
  level: string
  countryCode: string
  placement: string
  videoUrl: string
  bodyweight: string
  best: Record<LiftKey, string>
  attempts: Record<LiftKey, string[]>
  photoUrls: string[]
}

export function createEmptyForm(): FormState {
  return {
    name: '',
    date: todayStr(),
    category: '',
    level: '',
    countryCode: '',
    placement: '',
    videoUrl: '',
    bodyweight: '',
    best: { squat: '', bench: '', deadlift: '' },
    attempts: { squat: ['', '', ''], bench: ['', '', ''], deadlift: ['', '', ''] },
    photoUrls: [],
  }
}

export function formFrom(comp: Competition): FormState {
  const str = (v: number | null) => (v != null ? String(v) : '')
  return {
    name: comp.name,
    date: comp.date,
    category: comp.category ?? '',
    level: comp.level ?? '',
    countryCode: comp.country_code ?? '',
    placement: str(comp.placement),
    videoUrl: comp.video_url ?? '',
    bodyweight: str(comp.bodyweight),
    best: {
      squat: str(comp.squat),
      bench: str(comp.bench),
      deadlift: str(comp.deadlift),
    },
    attempts: {
      squat: attemptsOf(comp, 'squat').map(str),
      bench: attemptsOf(comp, 'bench').map(str),
      deadlift: attemptsOf(comp, 'deadlift').map(str),
    },
    photoUrls: comp.photo_urls ?? [],
  }
}

/**
 * Une URL saisie librement finit dans un href : on n'accepte que http(s).
 * Un lien « javascript:… » y serait une faille XSS, et « data: » permettrait
 * d'injecter une page arbitraire. Tout le reste est ignoré.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

/** Champ numérique optionnel : vide ou invalide → null. */
export function num(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseFloat(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
