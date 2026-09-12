import { parseLocalDate, type SetData } from '@/lib/powerlifting'

export interface ExerciceRow { id: string | null; uid: string; name: string; coachTracking: SetData[]; tracking: SetData[]; comments: string; painLevel: number | null; }
export interface WorkoutSetRow { id: string; date: string; exercise_name: string | null; coach_tracking_data: SetData[] | null; tracking_data: SetData[] | null; comments: string | null; fatigue_score: number | null; sleep_hours: number | null; steps_count: number | null; order_index: number | null; pain_level?: number | null; coach_reps?: number | string | null; coach_weight?: number | string | null; coach_rpe?: number | string | null; }
export interface UserProgress { id: string; level: number; current_xp: number; total_xp: number; streak_days: number | null; last_completed_date: string | null; }
export const REST_NAMES = ['Repos', 'Jour de Repos']
export const videSet = (): SetData => ({ reps: '', weight: '', rpe: '' })
export const creerExerciceVierge = (): ExerciceRow => ({ id: null, uid: crypto.randomUUID(), name: '', coachTracking: [videSet()], tracking: [videSet()], comments: '', painLevel: null, })
export const safeInt = (v: string, fallback = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback }
export const safeFloat = (v: string, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback }
export const formatDateAffichage = (dateStr: string, locale: string) => parseLocalDate(dateStr).toLocaleDateString(locale)
export const valeurRemplie = (v: unknown) => String(v ?? '').trim() !== ''
// Rien de saisi (nom, séries, notes, douleur) : pas de ligne en base pour cet exercice.
export const exerciceVide = (ex: ExerciceRow) => !valeurRemplie(ex.name) && !valeurRemplie(ex.comments) && ex.painLevel === null && [...ex.coachTracking, ...ex.tracking].every((s) => !valeurRemplie(s.reps) && !valeurRemplie(s.weight) && !valeurRemplie(s.rpe))
