import type { SetData } from '@/lib/powerlifting'

/**
 * Modèles de séance : une séance type (« Jambes ») rechargée en un appui.
 * Un modèle ne garde que le plan : noms, séries prescrites, notes.
 */

export const MODELES_MAX = 30
export const NOM_MODELE_MAX = 60
const EXERCICES_MAX = 30
const SERIES_MAX = 20

export interface ExerciceModele {
  nom: string
  prescription: SetData[]
  notes: string
}

export interface ModeleSeance {
  id: string
  nom: string
  exercices: ExerciceModele[]
}

/** Ce que la séance fournit pour créer un modèle. */
export interface ExerciceSource {
  name: string
  coachTracking: SetData[]
  tracking: SetData[]
  comments: string
}

const serieVide = (): SetData => ({ reps: '', weight: '', rpe: '' })
const serieRemplie = (s: SetData) => s.reps.trim() !== '' || s.weight.trim() !== ''
const texte = (valeur: unknown, max: number) => (typeof valeur === 'string' ? valeur.slice(0, max) : '')

/**
 * La séance en modèle : exercices nommés seulement ; pour chacun, les séries
 * prescrites, ou à défaut celles réellement faites (séance notée sans plan).
 */
export function versModele(exercices: ExerciceSource[]): ExerciceModele[] {
  return exercices
    .filter((ex) => ex.name.trim() !== '')
    .slice(0, EXERCICES_MAX)
    .map((ex) => {
      const plan = ex.coachTracking.filter(serieRemplie)
      const series = plan.length > 0 ? plan : ex.tracking.filter(serieRemplie).map((s) => ({ ...s, rpe: '' }))
      return {
        nom: ex.name.trim().slice(0, 120),
        prescription: (series.length > 0 ? series : [serieVide()]).slice(0, SERIES_MAX).map((s) => ({ reps: s.reps, weight: s.weight, rpe: s.rpe })),
        notes: ex.comments.slice(0, 500),
      }
    })
}

/** Relit un modèle venu de la base : le JSON est libre, tout est revérifié. */
export function normaliserModele(ligne: unknown): ModeleSeance | null {
  if (!ligne || typeof ligne !== 'object') return null
  const { id, nom, exercices } = ligne as Record<string, unknown>
  if (typeof id !== 'string' || typeof nom !== 'string' || nom.trim() === '' || !Array.isArray(exercices)) return null
  const liste = exercices.slice(0, EXERCICES_MAX).flatMap((ex): ExerciceModele[] => {
    if (!ex || typeof ex !== 'object') return []
    const { nom: nomExercice, prescription, notes } = ex as Record<string, unknown>
    if (typeof nomExercice !== 'string' || nomExercice.trim() === '') return []
    const series = (Array.isArray(prescription) ? prescription : []).slice(0, SERIES_MAX).flatMap((s): SetData[] => {
      if (!s || typeof s !== 'object') return []
      const { reps, weight, rpe } = s as Record<string, unknown>
      return [{ reps: texte(reps, 20), weight: texte(weight, 20), rpe: texte(rpe, 10) }]
    })
    return [{ nom: nomExercice.slice(0, 120), prescription: series.length > 0 ? series : [serieVide()], notes: texte(notes, 500) }]
  })
  return liste.length > 0 ? { id, nom: nom.slice(0, NOM_MODELE_MAX), exercices: liste } : null
}
