import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PALIER_NIVEAU, XP_REPOS, appliquerPoints, multiplicateurSerie, pointsDeBase, pointsGagnes,
  type JourneeValidee,
} from '../lib/xp'

const journee = (champs: Partial<JourneeValidee> = {}): JourneeValidee => ({
  repos: false, pas: 0, sommeil: 6, exercices: [], mode: 'powerlifting', ...champs,
})

test('un jour de repos vaut un forfait, sans bonus de mesures', () => {
  assert.equal(pointsDeBase(journee({ repos: true, pas: 20000, sommeil: 9 })), XP_REPOS)
})

test('chaque objectif de la journee ajoute ses points', () => {
  assert.equal(pointsDeBase(journee()), 50)
  assert.equal(pointsDeBase(journee({ pas: 8000 })), 75)
  assert.equal(pointsDeBase(journee({ sommeil: 7.5 })), 75)
  assert.equal(pointsDeBase(journee({ exercices: [{ name: 'Back Squat' }] })), 100)
  assert.equal(pointsDeBase(journee({ exercices: [{ name: 'Pull-ups' }] })), 100)
  // Journee complete : seance + pas + sommeil + mouvement principal + accessoire.
  assert.equal(pointsDeBase(journee({ pas: 8000, sommeil: 8, exercices: [{ name: 'Back Squat' }, { name: 'Pull-ups' }] })), 200)
})

test('les accessoires dependent du mode du compte', () => {
  assert.equal(pointsDeBase(journee({ mode: 'fitness', exercices: [{ name: 'Plancha' }] })), 100)
  assert.equal(pointsDeBase(journee({ mode: 'powerlifting', exercices: [{ name: 'Plancha' }] })), 50)
})

test('la serie multiplie les points par paliers', () => {
  assert.equal(multiplicateurSerie(0), 1)
  assert.equal(multiplicateurSerie(2), 1)
  assert.equal(multiplicateurSerie(3), 1.1)
  assert.equal(multiplicateurSerie(5), 1.25)
  assert.equal(multiplicateurSerie(7), 1.5)
  assert.equal(multiplicateurSerie(30), 1.5)
  assert.equal(pointsGagnes(journee({ repos: true }), 7), 75)
  assert.equal(pointsGagnes(journee({ repos: true }), 3), 55)
})

test('les points font monter de niveau, plusieurs fois si besoin', () => {
  const depart = { level: 1, current_xp: 950, total_xp: 4950 }
  const apres = appliquerPoints(depart, 100)
  assert.deepEqual(apres, { level: 2, current_xp: 50, total_xp: 5050, monteDeNiveau: true })

  const sansMontee = appliquerPoints({ level: 1, current_xp: 0, total_xp: 0 }, 200)
  assert.equal(sansMontee.monteDeNiveau, false)
  assert.equal(sansMontee.level, 1)

  // Un gros gain peut franchir deux paliers (1000 puis 2000).
  const double = appliquerPoints({ level: 1, current_xp: 0, total_xp: 0 }, 3 * PALIER_NIVEAU)
  assert.equal(double.level, 3)
  assert.equal(double.monteDeNiveau, true)
})
