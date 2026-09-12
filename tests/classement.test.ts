import { test } from 'node:test'
import assert from 'node:assert/strict'
import { grouperParMois, joursRestants, libelleMois, palmares, ranger, type LigneClassement } from '../lib/classement'

const ligne = (prenom: string, points: number, mois = '2026-09-01'): LigneClassement => ({
  mois, depuis: mois === '2026-09-01' ? '2026-09-14' : mois, prenom, est_moi: prenom === 'Moti', points,
  pts_pas: 0, pts_seances: points, pts_objectif: 0, pts_serie: 0,
  jours_8000: 0, seances: 0, objectif_fait: 0, objectif_semaines: 0, objectif_atteint: false,
  serie: 0, niveau: 1, streak: 0,
})

test('le rang suit les points, et une egalite partage la place', () => {
  assert.deepEqual(ranger([ligne('Moti', 35), ligne('Yamina', 105)]).map((l) => [l.prenom, l.rang]), [['Yamina', 1], ['Moti', 2]])
  assert.deepEqual(ranger([ligne('Moti', 60), ligne('Yamina', 60)]).map((l) => l.rang), [1, 1])
})

test('les mois sont groupes du plus recent au plus ancien', () => {
  const mois = grouperParMois([
    ligne('Moti', 10, '2026-08-01'), ligne('Yamina', 20, '2026-08-01'),
    ligne('Moti', 105), ligne('Yamina', 35),
  ])
  assert.deepEqual(mois.map((m) => m.mois), ['2026-09-01', '2026-08-01'])
  assert.equal(mois[0].depuis, '2026-09-14')
  assert.equal(mois[0].lignes[0].prenom, 'Moti')
})

test('le palmares ignore les mois sans le moindre point', () => {
  const mois = grouperParMois([
    ligne('Moti', 105), ligne('Yamina', 35),
    ligne('Moti', 0, '2026-08-01'), ligne('Yamina', 0, '2026-08-01'),
    ligne('Moti', 40, '2026-07-01'), ligne('Yamina', 40, '2026-07-01'),
  ])
  const { victoires, egalites, joues } = palmares(mois, ['Moti', 'Yamina'])
  assert.deepEqual(joues.map((m) => m.mois), ['2026-09-01', '2026-07-01'])
  assert.equal(victoires.get('Moti'), 1)
  assert.equal(victoires.get('Yamina'), 0)
  assert.equal(egalites, 1)
})

test('les jours restants incluent aujourd hui et s arretent a zero', () => {
  assert.equal(joursRestants('2026-09-01', new Date(2026, 8, 30)), 1)
  assert.equal(joursRestants('2026-09-01', new Date(2026, 8, 29)), 2)
  assert.equal(joursRestants('2026-09-01', new Date(2026, 8, 14)), 17)
  // Mois deja termine.
  assert.equal(joursRestants('2026-08-01', new Date(2026, 8, 14)), 0)
  // Fevrier 2028, bissextile.
  assert.equal(joursRestants('2028-02-01', new Date(2028, 1, 28)), 2)
})

test('le libelle du mois suit la langue du profil', () => {
  assert.equal(libelleMois('2026-09-01', 'fr-FR'), 'Septembre 2026')
  assert.equal(libelleMois('2026-09-01', 'es-ES'), 'Septiembre de 2026')
})
