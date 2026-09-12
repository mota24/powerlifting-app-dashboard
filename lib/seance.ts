import { parseLocalDate, type SetData } from '@/lib/powerlifting'
import type { CleTraduction } from '@/lib/i18n'

export interface ExerciceRow { id: string | null; uid: string; name: string; coachTracking: SetData[]; tracking: SetData[]; comments: string; painLevel: number | null; }
export interface WorkoutSetRow { id: string; date: string; exercise_name: string | null; coach_tracking_data: SetData[] | null; tracking_data: SetData[] | null; comments: string | null; fatigue_score: number | null; sleep_hours: number | null; steps_count: number | null; order_index: number | null; pain_level?: number | null; coach_reps?: number | string | null; coach_weight?: number | string | null; coach_rpe?: number | string | null; }
export interface UserProgress { id: string; level: number; current_xp: number; total_xp: number; streak_days: number | null; last_completed_date: string | null; }
export const REST_NAMES = ['Repos', 'Jour de Repos']
export const videSet = (): SetData => ({ reps: '', weight: '', rpe: '' })
export const creerExerciceVierge = (): ExerciceRow => ({ id: null, uid: crypto.randomUUID(), name: '', coachTracking: [videSet()], tracking: [videSet()], comments: '', painLevel: null, })
export const safeInt = (v: string, fallback = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback }
export const safeFloat = (v: string, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback }
/**
 * Un exercice nommé « cardio » ne se note pas en séries : on garde le type
 * d'appareil dans `weight` et la durée en minutes dans `reps`. Les calculs de
 * tonnage et de 1RM ignorent ces lignes, puisqu'aucun poids n'y est chiffré.
 */
export const estCardio = (nom: string) => /cardio/i.test(nom)

export const CARDIOS: CleTraduction[] = ['cardioTapis', 'cardioEscaliers', 'cardioCourse', 'cardioVelo', 'cardioRameur', 'cardioElliptique', 'cardioMarche']

/** Minutes cumulées d'une liste de lignes de cardio. */
export function minutesCardio(series: SetData[]): number {
  return series.reduce((total, s) => {
    const n = Number.parseFloat((s?.reps ?? '').replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? total + n : total
  }, 0)
}

/** Série ajoutée au plan : reprise de la dernière si elle est déjà remplie. */
export function serieSuivante(series: SetData[]): SetData {
  const derniere = series[series.length - 1]
  return derniere && (valeurRemplie(derniere.reps) || valeurRemplie(derniere.weight)) ? { ...derniere } : videSet()
}

export const formatDateAffichage = (dateStr: string, locale: string) => parseLocalDate(dateStr).toLocaleDateString(locale)
export const valeurRemplie = (v: unknown) => String(v ?? '').trim() !== ''
// Rien de saisi (nom, séries, notes, douleur) : pas de ligne en base pour cet exercice.
export const exerciceVide = (ex: ExerciceRow) => !valeurRemplie(ex.name) && !valeurRemplie(ex.comments) && ex.painLevel === null && [...ex.coachTracking, ...ex.tracking].every((s) => !valeurRemplie(s.reps) && !valeurRemplie(s.weight) && !valeurRemplie(s.rpe))
