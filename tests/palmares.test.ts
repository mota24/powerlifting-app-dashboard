import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attemptsOf, bestLift, bestValid, formatKg, glOf, num, safeHttpUrl, totalOf, type Competition } from '../lib/palmares'

const competition = (champs: Partial<Competition> = {}): Competition => ({
  id: 'c1', name: 'Championnat', date: '2026-05-10', category: null, level: null, country_code: 'ES',
  placement: null, video_url: null, bodyweight: 117.2,
  squat: null, bench: null, deadlift: null,
  squat_1: null, squat_2: null, squat_3: null,
  bench_1: null, bench_2: null, bench_3: null,
  deadlift_1: null, deadlift_2: null, deadlift_3: null,
  photo_urls: null, ...champs,
})

test('un essai manque (valeur negative) ne compte jamais comme la meilleure barre', () => {
  assert.equal(bestValid([250, 262.5, -270]), 262.5)
  assert.equal(bestValid([-100, -110, null]), 0)
  assert.equal(bestValid([]), 0)
})

test('les essais priment sur la valeur saisie a la main', () => {
  const avecEssais = competition({ squat: 200, squat_1: 250, squat_2: 262.5, squat_3: -270 })
  assert.equal(bestLift(avecEssais, 'squat'), 262.5)

  const sansEssais = competition({ squat: 200 })
  assert.equal(bestLift(sansEssais, 'squat'), 200)
  assert.equal(bestLift(competition(), 'squat'), 0)
  assert.deepEqual(attemptsOf(avecEssais, 'squat'), [250, 262.5, -270])
})

test('le total additionne les trois meilleures barres et alimente l IPF GL', () => {
  const comp = competition({
    squat_1: 250, squat_2: 262.5, squat_3: -270,
    bench_1: 160, bench_2: 167.5,
    deadlift_1: 280, deadlift_2: 295, deadlift_3: 305,
  })
  assert.equal(totalOf(comp), 735)
  assert.ok(Math.abs(glOf(comp) - 86.33) < 0.05)
  // Sans poids de corps, pas de score.
  assert.equal(glOf(competition({ squat_1: 250, bodyweight: null })), 0)
})

test('un lien de rediffusion non http est refuse (faille XSS)', () => {
  assert.equal(safeHttpUrl('javascript:alert(1)'), null)
  assert.equal(safeHttpUrl('data:text/html,<script>'), null)
  assert.equal(safeHttpUrl(' https://youtube.com/watch?v=x '), 'https://youtube.com/watch?v=x')
  assert.equal(safeHttpUrl('http://exemple.fr'), 'http://exemple.fr')
  assert.equal(safeHttpUrl(null), null)
  assert.equal(safeHttpUrl(''), null)
})

test('un champ numerique accepte la virgule et refuse le reste', () => {
  assert.equal(num('167,5'), 167.5)
  assert.equal(num('167.5'), 167.5)
  assert.equal(num(''), null)
  assert.equal(num('   '), null)
  assert.equal(num('abc'), null)
})

test('un poids s affiche sans decimale inutile', () => {
  assert.equal(formatKg(295), '295')
  assert.equal(formatKg(167.5), '167,5')
})
