import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BAR_WEIGHT, PLATES, PLATES_FITNESS, bestE1RM, calculateIPFGL, classifyLift, computePlates,
  generateWarmup, parseLocalDate, parseNumericReps, roundToLoadable, setE1RM, setsTonnage,
  toLocalDateStr, weeksOut,
} from '../lib/powerlifting'
import {
  GRAMMES_MAX, LIMITES_OBJECTIFS, etatObjectif, grammesValides, lireObjectif, objectifValide,
  pourGrammes, recents, repereProteines, totauxDuJour, variantesCode, type EntreeJournal,
} from '../lib/nutrition'

// ————————————————————————————————————————————————
// Dates : tout passe par l'heure locale, jamais UTC
// ————————————————————————————————————————————————

test('une date locale fait l aller-retour, y compris au changement d heure', () => {
  assert.equal(toLocalDateStr(new Date(2026, 8, 12)), '2026-09-12')
  const debut = parseLocalDate('2026-01-01')
  for (let i = 0; i < 400; i++) {
    const jour = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i)
    assert.equal(toLocalDateStr(parseLocalDate(toLocalDateStr(jour))), toLocalDateStr(jour))
  }
})

test('le decompte avant competition arrondit au superieur', () => {
  assert.equal(weeksOut('2026-09-12', '2026-09-12'), 0)
  assert.equal(weeksOut('2026-09-12', '2026-09-11'), 0)
  assert.equal(weeksOut('2026-09-12', '2026-09-13'), 1)
  assert.equal(weeksOut('2026-09-05', '2026-09-12'), 1)
  assert.equal(weeksOut('2026-09-05', '2026-09-13'), 2)
})

// ————————————————————————————————————————————————
// Charge de la barre
// ————————————————————————————————————————————————

test('une charge est arrondie au chargeable le plus proche', () => {
  assert.equal(roundToLoadable(101), 100)
  assert.equal(roundToLoadable(10), BAR_WEIGHT)
  assert.equal(roundToLoadable(103), 102.5)
})

test('167,5 kg avec stop-disques se charge en 25/25/20/1,25 par cote', () => {
  const { plates, perSide, achievable, remainder } = computePlates(167.5, BAR_WEIGHT, PLATES, 2.5)
  assert.equal(perSide, 71.25)
  assert.deepEqual(plates.map((p) => p.weight), [25, 25, 20, 1.25])
  assert.equal(achievable, true)
  assert.equal(remainder, 0)
})

test('barre seule et charge impossible sont signalees', () => {
  const barre = computePlates(BAR_WEIGHT)
  assert.deepEqual(barre.plates, [])
  assert.equal(barre.achievable, true)

  const impossible = computePlates(21, BAR_WEIGHT, PLATES, 0)
  assert.equal(impossible.achievable, false)
  assert.equal(impossible.remainder, 0.5)
})

test('en salle, aucun disque de 25 kg n est propose', () => {
  const { plates, achievable } = computePlates(200, BAR_WEIGHT, PLATES_FITNESS, 0)
  assert.equal(achievable, true)
  assert.ok(plates.every((p) => p.weight <= 20))
})

test('l echauffement monte progressivement et reste chargeable', () => {
  const paliers = generateWarmup(180)
  assert.equal(paliers[0].weight, BAR_WEIGHT)
  assert.equal(paliers[0].pct, 0)
  for (const palier of paliers) {
    assert.ok(palier.weight >= BAR_WEIGHT)
    assert.equal((palier.weight - BAR_WEIGHT) % 2.5, 0)
  }
  for (let i = 1; i < paliers.length; i++) assert.ok(paliers[i].weight >= paliers[i - 1].weight)
  assert.ok(paliers[paliers.length - 1].weight < 180)
})

// ————————————————————————————————————————————————
// Séries, tonnage et 1RM estimé
// ————————————————————————————————————————————————

test('les reps en notation libre sont additionnees pour le tonnage', () => {
  assert.equal(parseNumericReps('3/4/5'), 12)
  assert.equal(parseNumericReps('3+2'), 5)
  assert.equal(parseNumericReps(''), 0)
  assert.equal(setsTonnage([{ reps: '5', weight: '100', rpe: '' }]), 500)
  assert.equal(setsTonnage([{ reps: '', weight: '100', rpe: '' }]), 0)
  assert.equal(setsTonnage(null), 0)
})

test('le 1RM estime prend le meilleur passage, pas la somme', () => {
  const unique = setE1RM({ reps: '5', weight: '100', rpe: '10' })
  const libre = setE1RM({ reps: '3/4/5', weight: '100', rpe: '10' })
  assert.equal(Math.round(libre), Math.round(unique))
  assert.ok(unique > 100 && unique < 130)
})

test('une serie plus facile (RPE bas) donne un 1RM estime plus haut', () => {
  assert.ok(setE1RM({ reps: '5', weight: '100', rpe: '8' }) > setE1RM({ reps: '5', weight: '100', rpe: '10' }))
  assert.equal(setE1RM({ reps: '5', weight: '', rpe: '8' }), 0)
  assert.equal(bestE1RM([{ reps: '5', weight: '100', rpe: '10' }, { reps: '1', weight: '130', rpe: '10' }]), 130)
})

test('le score IPF GL suit le total et reste nul sans donnees', () => {
  assert.equal(calculateIPFGL(0, 117), 0)
  assert.equal(calculateIPFGL(700, 0), 0)
  assert.ok(calculateIPFGL(800, 117.2) > calculateIPFGL(700, 117.2))
  assert.ok(calculateIPFGL(400, 60, 'female') > calculateIPFGL(400, 60, 'male'))
})

// ————————————————————————————————————————————————
// Classement des exercices
// ————————————————————————————————————————————————

test('un exercice est classe selon le mode du compte', () => {
  assert.equal(classifyLift('Back Squat'), 'squat')
  assert.equal(classifyLift('Paused Bench'), 'bench')
  assert.equal(classifyLift('Sumo Deadlift'), 'deadlift')
  assert.equal(classifyLift('Bulgarian Split Squat'), null)
  assert.equal(classifyLift(null), null)

  assert.equal(classifyLift('Hip Thrust', 'fitness'), 'bench')
  assert.equal(classifyLift('Peso muerto rumano', 'fitness'), 'deadlift')
  assert.equal(classifyLift('Sentadilla', 'fitness'), 'squat')
  // Un squat bulgare ne doit pas gonfler la courbe du squat.
  assert.equal(classifyLift('Sentadilla búlgara', 'fitness'), null)
  assert.equal(classifyLift('Prensa de piernas', 'fitness'), null)
})

// ————————————————————————————————————————————————
// Nutrition
// ————————————————————————————————————————————————

const entree = (champs: Partial<EntreeJournal>): EntreeJournal => ({
  id: 'x', date: '2026-09-12', nom: 'Riz', marque: null, code_barres: null,
  grammes: 100, kcal_100g: 100, proteines_100g: 10, ...champs,
})

test('les totaux du jour acceptent des nombres renvoyes en texte', () => {
  const totaux = totauxDuJour([
    entree({ kcal_100g: '250' as unknown as number, grammes: '200' as unknown as number, proteines_100g: '10' as unknown as number }),
    entree({ kcal_100g: 100, grammes: 50, proteines_100g: 4 }),
  ])
  assert.equal(totaux.kcal, 550)
  assert.equal(totaux.prot, 22)
  assert.equal(pourGrammes(250, 200), 500)
})

test('les grammes hors bornes sont refuses', () => {
  assert.equal(grammesValides(0), false)
  assert.equal(grammesValides(GRAMMES_MAX), true)
  assert.equal(grammesValides(GRAMMES_MAX + 1), false)
  assert.equal(grammesValides(Number.NaN), false)
})

test('les aliments recents sont dedoublonnes par code puis par nom', () => {
  const liste = recents([
    entree({ id: '1', nom: 'Riz', code_barres: '123' }),
    entree({ id: '2', nom: 'Riz', code_barres: '123' }),
    entree({ id: '3', nom: 'riz complet' }),
    entree({ id: '4', nom: 'Riz complet' }),
  ])
  assert.equal(liste.length, 2)
  assert.equal(liste[0].code, '123')
})

test('un objectif se saisit en entier, vide ou rien', () => {
  assert.equal(lireObjectif(''), null)
  assert.equal(lireObjectif('2 000'), 2000)
  assert.equal(lireObjectif('20.5'), 'invalide')
  assert.equal(objectifValide(null, LIMITES_OBJECTIFS.kcal), true)
  assert.equal(objectifValide(799, LIMITES_OBJECTIFS.kcal), false)
  assert.equal(objectifValide(800, LIMITES_OBJECTIFS.kcal), true)
})

test('l etat de l objectif distingue reste, atteint et depasse', () => {
  assert.deepEqual(etatObjectif(1500, 2000, false), { part: 0.75, etat: 'reste', ecart: 500 })
  assert.deepEqual(etatObjectif(2100, 2000, false), { part: 1, etat: 'depasse', ecart: 100 })
  // Depasser les proteines est une reussite, pas un depassement.
  assert.equal(etatObjectif(150, 120, true).etat, 'atteint')
  assert.equal(repereProteines(100).conseil, 180)
})

test('un code-barres a 12 chiffres est aussi cherche avec son zero', () => {
  assert.deepEqual(variantesCode('123456789012'), ['123456789012', '0123456789012'])
  assert.deepEqual(variantesCode('0123456789012'), ['0123456789012', '123456789012'])
  assert.deepEqual(variantesCode('12345'), ['12345'])
})
