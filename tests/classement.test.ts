import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  estDimanche, gagnants, grouperParMois, grouperParSemaine, joursRestants, joursRestantsSemaine,
  libelleMois, palmares, ranger, type LigneClassement, type LigneSemaine,
} from '../lib/classement'

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

test('la semaine se lit avec les memes cartes que le mois', () => {
  const semaine = (prenom: string, points: number, objectif_fait: number): LigneSemaine => ({
    semaine: '2026-09-07', prenom, est_moi: false, points,
    pts_pas: 0, pts_seances: points, pts_objectif: 0, pts_serie: 0,
    jours_8000: 0, seances: objectif_fait, objectif_fait, objectif_seances: 3, objectif_atteint: objectif_fait >= 3,
    serie: 0, niveau: 1, streak: 0,
  })
  const [courante] = grouperParSemaine([semaine('Moti', 105, 3), semaine('Yamina', 35, 1)])
  assert.equal(courante.mois, '2026-09-07')
  assert.equal(courante.depuis, '2026-09-07')
  // « 3/3 » pour la semaine, comme « 1/2 semaines reussies » pour le mois.
  assert.deepEqual(courante.lignes.map((l) => `${l.objectif_fait}/${l.objectif_semaines}`), ['3/3', '1/3'])
  assert.equal(courante.lignes[0].prenom, 'Moti')
})

test('personne ne gagne tant que personne n a marque', () => {
  const [nul] = grouperParMois([ligne('Moti', 0), ligne('Yamina', 0)])
  assert.deepEqual(gagnants(nul.lignes), [])
  const [joue] = grouperParMois([ligne('Moti', 105), ligne('Yamina', 35)])
  assert.deepEqual(gagnants(joue.lignes).map((l) => l.prenom), ['Moti'])
  const [nul2] = grouperParMois([ligne('Moti', 60), ligne('Yamina', 60)])
  assert.equal(gagnants(nul2.lignes).length, 2)
})

test('la semaine se cloture le dimanche', () => {
  // 13/09/2026 est un dimanche.
  assert.equal(estDimanche(new Date(2026, 8, 13)), true)
  assert.equal(joursRestantsSemaine(new Date(2026, 8, 13)), 1)
  assert.equal(joursRestantsSemaine(new Date(2026, 8, 14)), 7)
  assert.equal(joursRestantsSemaine(new Date(2026, 8, 18)), 3)
})

test('le libelle du mois suit la langue du profil', () => {
  assert.equal(libelleMois('2026-09-01', 'fr-FR'), 'Septembre 2026')
  assert.equal(libelleMois('2026-09-01', 'es-ES'), 'Septiembre de 2026')
})
