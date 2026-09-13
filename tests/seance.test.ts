import { test } from 'node:test'
import assert from 'node:assert/strict'
import { joursProgrammes, nouvelleSerie, type LigneJour } from '../lib/serie'
import { chargeSuivante, cleExercice, seriePrescrite, suggererProgression } from '../lib/progression'
import {
  MINUTES_REPOS_MINI, activiteReposVide, ecrireActiviteRepos, estCardio, exerciceVide, formatDateAffichage,
  creerExerciceVierge, lireActiviteRepos, minutesCardio, reposActif, serieSuivante, type ExerciceRow,
} from '../lib/seance'
import { setsTonnage } from '../lib/powerlifting'
import { DEFAULT_WORK, buildSequence, clampConfig, formatDuree, normalizeWorkTimes } from '../lib/circuit'

const serie = (reps: string, poids: string, rpe = '') => ({ reps, weight: poids, rpe })
const ligne = (champs: Partial<LigneJour>): LigneJour => ({
  date: '2026-09-10', exercise_name: 'Back Squat', tracking_data: null, coach_tracking_data: null, ...champs,
})

// ————————————————————————————————————————————————
// Série de validations
// ————————————————————————————————————————————————

test('la serie demarre a 1 et ne bouge pas deux fois le meme jour', () => {
  assert.equal(nouvelleSerie(7, null, '2026-09-12', new Set()), 1)
  assert.equal(nouvelleSerie(7, '2026-09-12', '2026-09-12', new Set()), 7)
})

test('un jour de repos ne casse pas la serie, un jour programme oui', () => {
  assert.equal(nouvelleSerie(3, '2026-09-11', '2026-09-12', new Set()), 4)
  assert.equal(nouvelleSerie(3, '2026-09-09', '2026-09-12', new Set()), 4)
  assert.equal(nouvelleSerie(3, '2026-09-09', '2026-09-12', new Set(['2026-09-10'])), 1)
  // Le jour meme n'est pas un trou : c'est celui qu'on valide.
  assert.equal(nouvelleSerie(3, '2026-09-11', '2026-09-12', new Set(['2026-09-12'])), 4)
})

test('une derniere validation dans le futur repart de zero', () => {
  assert.equal(nouvelleSerie(5, '2026-09-20', '2026-09-12', new Set()), 1)
})

test('seuls les jours avec un plan ou une serie notee comptent comme programmes', () => {
  const jours = joursProgrammes([
    ligne({ date: '2026-09-10', coach_tracking_data: [serie('5', '100')] }),
    ligne({ date: '2026-09-11', exercise_name: 'Jour de Repos', coach_tracking_data: [serie('5', '100')] }),
    ligne({ date: '2026-09-12', tracking_data: [serie('', '')] }),
  ])
  assert.deepEqual([...jours], ['2026-09-10'])
})

// ————————————————————————————————————————————————
// Progression suggérée (muscu)
// ————————————————————————————————————————————————

test('tout reussi propose la charge suivante, un echec ne propose rien', () => {
  const plan = [serie('10', '20'), serie('10', '20')]
  const reussi = { coach: plan, fait: [serie('10', '20'), serie('10', '20')] }
  assert.deepEqual(suggererProgression(reussi, plan), { poids: 22.5, ancien: 20 })

  const manque = { coach: plan, fait: [serie('10', '20'), serie('8', '20')] }
  assert.equal(suggererProgression(manque, plan), null)
  assert.equal(suggererProgression(undefined, plan), null)
})

test('rien a suggerer si la charge a deja ete montee dans le plan du jour', () => {
  const precedente = { coach: [serie('10', '20')], fait: [serie('10', '20')] }
  assert.equal(suggererProgression(precedente, [serie('10', '25')]), null)
})

test('le pas de progression depend de la charge', () => {
  assert.equal(chargeSuivante(8), 9)
  assert.equal(chargeSuivante(40), 42.5)
  assert.equal(seriePrescrite(serie('10', '20')), true)
  assert.equal(seriePrescrite(serie('10', '')), false)
  assert.equal(cleExercice('  Back Squat '), 'back squat')
})

// ————————————————————————————————————————————————
// Contenu d'une séance
// ————————————————————————————————————————————————

const exercice = (champs: Partial<ExerciceRow> = {}): ExerciceRow => ({ ...creerExerciceVierge(), ...champs })

test('un exercice sans rien saisi n est pas enregistre', () => {
  assert.equal(exerciceVide(exercice()), true)
  assert.equal(exerciceVide(exercice({ name: 'Squat' })), false)
  assert.equal(exerciceVide(exercice({ tracking: [serie('5', '')] })), false)
  assert.equal(exerciceVide(exercice({ comments: 'tempo 3-1-1' })), false)
  assert.equal(exerciceVide(exercice({ painLevel: 0 })), false)
  // Des espaces ne sont pas une saisie.
  assert.equal(exerciceVide(exercice({ name: '   ' })), true)
})

test('la serie ajoutee au plan reprend la precedente quand elle est remplie', () => {
  assert.deepEqual(serieSuivante([serie('10', '60', '8')]), serie('10', '60', '8'))
  assert.deepEqual(serieSuivante([serie('', '')]), serie('', ''))
  assert.deepEqual(serieSuivante([]), serie('', ''))
})

test('un exercice nomme cardio se note en duree, pas en series', () => {
  assert.equal(estCardio('Cardio'), true)
  assert.equal(estCardio('CARDIO tapis'), true)
  assert.equal(estCardio('cardio'), true)
  assert.equal(estCardio('Back Squat'), false)
  assert.equal(minutesCardio([serie('20', 'Tapis de course'), serie('10,5', 'Vélo')]), 30.5)
  assert.equal(minutesCardio([serie('', 'Tapis de course')]), 0)
  // Le type d'appareil occupe la colonne du poids : aucun tonnage ne doit en sortir.
  assert.equal(setsTonnage([serie('20', 'Tapis de course')]), 0)
})

test('la date affichee suit la locale, sans decalage de fuseau', () => {
  assert.equal(formatDateAffichage('2026-09-12', 'fr-FR'), '12/09/2026')
})

// ————————————————————————————————————————————————
// Chronomètre de circuit
// ————————————————————————————————————————————————

test('les durees de travail sont completees ou tronquees selon le nombre d exercices', () => {
  assert.deepEqual(normalizeWorkTimes([40], 3), [40, 40, 40])
  assert.deepEqual(normalizeWorkTimes([40, 50, 60, 70], 2), [40, 50])
  assert.deepEqual(normalizeWorkTimes(undefined, 2), [DEFAULT_WORK, DEFAULT_WORK])
})

test('la sequence enchaine preparation, travail, repos et repos long', () => {
  const phases = buildSequence({ prep: 5, exercices: 2, workTimes: [30, 40], rest: 15, tours: 2, longRest: 60 })
  assert.deepEqual(phases.map((p) => p.kind), ['prep', 'work', 'rest', 'work', 'longRest', 'work', 'rest', 'work'])
  assert.equal(phases.reduce((total, p) => total + p.duration, 0), 235)
  // Pas de repos long apres le dernier tour.
  assert.equal(phases[phases.length - 1].kind, 'work')
})

test('une preparation ou un repos a zero disparait de la sequence', () => {
  const phases = buildSequence({ prep: 0, exercices: 2, workTimes: [30, 30], rest: 0, tours: 1, longRest: 0 })
  assert.deepEqual(phases.map((p) => p.kind), ['work', 'work'])
})

test('les reglages relus sont bornes et le format reste lisible', () => {
  assert.deepEqual(clampConfig({ prep: 999, exercices: 0, tours: 50 }), { prep: 60, exercices: 1, tours: 20 })
  assert.deepEqual(clampConfig({ work: 10 }).workTimes, [10])
  assert.deepEqual(clampConfig({}), {})
  assert.equal(formatDuree(95), '1:35')
  assert.equal(formatDuree(45), '45')
})

test('une activite de jour de repos fait l aller-retour et compte a partir de 10 min', () => {
  const activite = { type: 'mobilite' as const, minutes: '20' }
  const range = ecrireActiviteRepos(activite)
  assert.deepEqual(range, [{ reps: '20', weight: 'mobilite', rpe: '' }])
  assert.deepEqual(lireActiviteRepos(range), activite)
  // Rien de choisi : rien d ecrit, rien a relire.
  assert.deepEqual(ecrireActiviteRepos(activiteReposVide()), [])
  assert.deepEqual(lireActiviteRepos(null), { type: null, minutes: '' })
  // Une ligne de series ordinaire n est pas une activite de repos.
  assert.deepEqual(lireActiviteRepos([{ reps: '10', weight: '60', rpe: '' }]), { type: null, minutes: '' })
})

test('le bonus du repos actif exige le minimum de minutes', () => {
  assert.equal(reposActif({ type: 'cardioVelo', minutes: String(MINUTES_REPOS_MINI) }), true)
  assert.equal(reposActif({ type: 'cardioVelo', minutes: '9' }), false)
  assert.equal(reposActif({ type: 'cardioVelo', minutes: '' }), false)
  assert.equal(reposActif({ type: null, minutes: '30' }), false)
})
