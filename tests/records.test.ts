import { test } from 'node:test'
import assert from 'node:assert/strict'
import { meilleursParMouvement, recordsBattus, type LigneHistorique } from '../lib/records'

const ligne = (nom: string, reps: string, poids: string): LigneHistorique => ({
  exercise_name: nom, tracking_data: [{ reps, weight: poids, rpe: '' }],
})

test('un record est battu quand le 1RM estime depasse le meilleur precedent', () => {
  const avant = [ligne('Hip trust ', '10', '120')]
  assert.deepEqual(recordsBattus([ligne('Hip Thrust', '10', '130')], avant, 'fitness'), ['bench'])
  // Egalite : pas de record.
  assert.deepEqual(recordsBattus([ligne('Hip Thrust', '10', '120')], avant, 'fitness'), [])
  // Moins lourd : pas de record.
  assert.deepEqual(recordsBattus([ligne('Hip Thrust', '10', '100')], avant, 'fitness'), [])
})

test('un premier enregistrement n est pas un record', () => {
  assert.deepEqual(recordsBattus([ligne('Rdl', '10', '60')], [], 'fitness'), [])
  assert.deepEqual(recordsBattus([ligne('Rdl', '10', '60')], [ligne('Hip thrust', '10', '120')], 'fitness'), [])
})

test('plus de reps a la meme charge est aussi un record', () => {
  assert.deepEqual(recordsBattus([ligne('Deadlift', '3', '300')], [ligne('Deadlift', '1', '300')], 'powerlifting'), ['deadlift'])
})

test('les exercices non suivis et les ecarts d arrondi sont ignores', () => {
  assert.deepEqual(recordsBattus([ligne('Step up', '12', '40')], [ligne('Step up', '12', '20')], 'fitness'), [])
  const meilleurs = meilleursParMouvement([ligne('Back Squat', '5', '100'), ligne('Bench Press', '1', '150')], 'powerlifting')
  assert.equal(Math.round(meilleurs.bench ?? 0), 150)
  assert.equal(meilleurs.deadlift, undefined)
})
