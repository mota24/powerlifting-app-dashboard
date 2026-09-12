import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { lireSession } from '../lib/compte'

const vraiFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = vraiFetch })

function repondre(reponse: Response | (() => never)) {
  globalThis.fetch = (async () => (typeof reponse === 'function' ? reponse() : reponse)) as typeof fetch
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

test('une session valide renvoie l utilisateur', async () => {
  repondre(json({ user: { id: 'u1', email: '1@power.app' } }))
  assert.deepEqual(await lireSession(), { statut: 'connecte', user: { id: 'u1', email: '1@power.app' } })
})

test('un 401 est une deconnexion', async () => {
  repondre(json({ user: null }, 401))
  assert.deepEqual(await lireSession(), { statut: 'deconnecte' })
})

test('une reponse sans utilisateur est une deconnexion', async () => {
  repondre(json({ user: null }))
  assert.deepEqual(await lireSession(), { statut: 'deconnecte' })
})

test('une coupure reseau n est PAS une deconnexion', async () => {
  repondre(() => { throw new TypeError('Failed to fetch') })
  assert.deepEqual(await lireSession(), { statut: 'indisponible' })
})

test('une limite de debit ou une panne serveur n est pas une deconnexion', async () => {
  repondre(json({ error: 'Trop de requêtes' }, 429))
  assert.deepEqual(await lireSession(), { statut: 'indisponible' })
  repondre(json({ error: 'boom' }, 503))
  assert.deepEqual(await lireSession(), { statut: 'indisponible' })
})
