export interface CircuitConfig {
  prep: number;
  exercices: number;
  workTimes: number[];
  rest: number;
  tours: number;
  longRest: number;
}

export const WORK_MIN = 5
export const WORK_MAX = 3600 
export const DEFAULT_WORK = 40

export const DEFAULT_CONFIG: CircuitConfig = { prep: 5, exercices: 3, workTimes: [40, 40, 40], rest: 15, tours: 3, longRest: 40 }
export const CONFIG_KEY = 'circuit_timer_config'

export function normalizeWorkTimes(workTimes: number[] | undefined, exercices: number): number[] {
  const source = Array.isArray(workTimes) ? workTimes : []
  const out = source.slice(0, exercices)
  while (out.length < exercices) {
    out.push(out.length > 0 ? out[out.length - 1] : DEFAULT_WORK)
  }
  return out
}

export type PhaseKind = 'prep' | 'work' | 'rest' | 'longRest'

export interface Phase {
  kind: PhaseKind;
  duration: number;
  exercice: number;
  tour: number;
}

export type Status = 'config' | 'running' | 'paused' | 'finished'

export function buildSequence(cfg: CircuitConfig): Phase[] {
  const phases: Phase[] = []
  const workTimes = normalizeWorkTimes(cfg.workTimes, cfg.exercices)
  if (cfg.prep > 0) phases.push({ kind: 'prep', duration: cfg.prep, exercice: 1, tour: 1 })
  for (let tour = 1; tour <= cfg.tours; tour++) {
    for (let ex = 1; ex <= cfg.exercices; ex++) {
      phases.push({ kind: 'work', duration: workTimes[ex - 1] ?? DEFAULT_WORK, exercice: ex, tour })
      if (ex < cfg.exercices && cfg.rest > 0) {
        phases.push({ kind: 'rest', duration: cfg.rest, exercice: ex + 1, tour })
      }
    }
    if (tour < cfg.tours && cfg.longRest > 0) {
      phases.push({ kind: 'longRest', duration: cfg.longRest, exercice: 1, tour: tour + 1 })
    }
  }
  return phases
}

export function clampConfig(raw: Partial<CircuitConfig> & { work?: unknown }): Partial<CircuitConfig> {
  const clamp = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined
  const out: Partial<CircuitConfig> = {}
  const prep = clamp(raw.prep, 0, 60); if (prep !== undefined) out.prep = prep
  const exercices = clamp(raw.exercices, 1, 20); if (exercices !== undefined) out.exercices = exercices
  const rest = clamp(raw.rest, 0, 3600); if (rest !== undefined) out.rest = rest
  const tours = clamp(raw.tours, 1, 20); if (tours !== undefined) out.tours = tours
  const longRest = clamp(raw.longRest, 0, 3600); if (longRest !== undefined) out.longRest = longRest
  if (Array.isArray(raw.workTimes)) {
    const arr = raw.workTimes
      .map((w) => clamp(w, WORK_MIN, WORK_MAX))
      .filter((w): w is number => w !== undefined)
    if (arr.length > 0) out.workTimes = arr
  } else {
    const legacy = clamp(raw.work, WORK_MIN, WORK_MAX)
    if (legacy !== undefined) out.workTimes = [legacy]
  }
  return out
}

export function lireConfig(): CircuitConfig {
  try {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (!saved) return DEFAULT_CONFIG
    const merged = { ...DEFAULT_CONFIG, ...clampConfig(JSON.parse(saved)) }
    return { ...merged, workTimes: normalizeWorkTimes(merged.workTimes, merged.exercices) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export const formatDuree = (totalSec: number) => {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}`
}
