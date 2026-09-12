import { ACCESSORIES, FIT_ACCESSOIRES, classifyLift, type ModeApp } from './powerlifting'

/**
 * Points d'expérience d'une journée validée. Règles volontairement simples et
 * gardées ici, hors de l'affichage, pour rester vérifiables.
 */

export const XP_REPOS = 50
export const XP_SEANCE = 50
export const XP_PAS = 25
export const XP_SOMMEIL = 25
export const XP_MOUVEMENTS = 50
export const XP_ACCESSOIRES = 50
export const PAS_OBJECTIF = 8000
export const SOMMEIL_OBJECTIF = 7.5
/** Points nécessaires pour passer du niveau N au niveau N+1. */
export const PALIER_NIVEAU = 1000

export interface JourneeValidee {
  repos: boolean
  pas: number
  sommeil: number
  exercices: { name: string }[]
  mode: ModeApp
}

export interface Progression {
  level: number
  current_xp: number
  total_xp: number
}

/** Points avant le bonus de régularité. */
export function pointsDeBase(journee: JourneeValidee): number {
  if (journee.repos) return XP_REPOS
  let points = XP_SEANCE
  if (journee.pas >= PAS_OBJECTIF) points += XP_PAS
  if (journee.sommeil >= SOMMEIL_OBJECTIF) points += XP_SOMMEIL
  if (journee.exercices.some((ex) => classifyLift(ex.name, journee.mode) !== null)) points += XP_MOUVEMENTS
  const accessoires = journee.mode === 'fitness' ? FIT_ACCESSOIRES : ACCESSORIES
  if (journee.exercices.some((ex) => accessoires.includes(ex.name))) points += XP_ACCESSOIRES
  return points
}

/** Plus la série est longue, plus la journée rapporte. */
export function multiplicateurSerie(serie: number): number {
  if (serie >= 7) return 1.5
  if (serie >= 5) return 1.25
  if (serie >= 3) return 1.1
  return 1
}

export function pointsGagnes(journee: JourneeValidee, serie: number): number {
  return Math.round(pointsDeBase(journee) * multiplicateurSerie(serie))
}

/** Ajoute les points et fait monter le niveau autant de fois que nécessaire. */
export function appliquerPoints(progression: Progression, gagnes: number): Progression & { monteDeNiveau: boolean } {
  let level = progression.level
  let current_xp = progression.current_xp + gagnes
  let palier = level * PALIER_NIVEAU
  let monteDeNiveau = false
  while (current_xp >= palier) {
    current_xp -= palier
    level += 1
    palier = level * PALIER_NIVEAU
    monteDeNiveau = true
  }
  return { level, current_xp, total_xp: progression.total_xp + gagnes, monteDeNiveau }
}
