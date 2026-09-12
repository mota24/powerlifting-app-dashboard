import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { compteDepuisEmail, emailDuCompte, emailDuJeton, origineAutorisee } from '../lib/server/auth-session'
import { cheminProxyAutorise } from '../lib/server/proxy-db'

// ————————————————————————————————————————————————
// Identité du compte : liée à l'e-mail COMPLET
//
// La faille corrigée : le compte était déduit du texte avant le « @ ».
// Les inscriptions étant ouvertes, n'importe qui pouvait créer
// « 1@autre-domaine.com » et devenir le compte 1.
// ————————————————————————————————————————————————

test('seul un e-mail du domaine de l app designe un compte', () => {
  assert.equal(compteDepuisEmail('1@power.app'), '1')
  assert.equal(compteDepuisEmail('2@POWER.APP'), '2')
  assert.equal(compteDepuisEmail('1@autre-domaine.com'), null)
  assert.equal(compteDepuisEmail('1@power.app.evil.com'), null)
  assert.equal(compteDepuisEmail('1@x@power.app'), null)
  assert.equal(compteDepuisEmail('../x@power.app'), null)
  assert.equal(compteDepuisEmail(null), null)
  assert.equal(compteDepuisEmail(''), null)
})

test('un identifiant saisi devient un e-mail du domaine, ou rien', () => {
  assert.equal(emailDuCompte(' 1 '), '1@power.app')
  assert.equal(emailDuCompte('1@autre.com'), null)
  assert.equal(emailDuCompte('   '), null)
})

test('l e-mail du jeton est lu sans faire confiance a sa signature', () => {
  const charge = Buffer.from(JSON.stringify({ email: '1@autre-domaine.com' })).toString('base64url')
  assert.equal(emailDuJeton(`eyJhbGciOiJIUzI1NiJ9.${charge}.signature`), '1@autre-domaine.com')
  assert.equal(emailDuJeton('pas-un-jeton'), null)
  assert.equal(emailDuJeton('a.b@@.c'), null)
})

// ————————————————————————————————————————————————
// CSRF : une écriture doit venir du site lui-même
// ————————————————————————————————————————————————

const requete = (headers: Record<string, string>) =>
  new NextRequest('https://app.test/api/db/rest/v1/x', { method: 'POST', headers })

test('une ecriture venue d un autre site est refusee', () => {
  assert.equal(origineAutorisee(requete({ 'sec-fetch-site': 'same-origin' })), true)
  assert.equal(origineAutorisee(requete({ 'sec-fetch-site': 'none' })), true)
  assert.equal(origineAutorisee(requete({ 'sec-fetch-site': 'cross-site' })), false)
  assert.equal(origineAutorisee(requete({ 'sec-fetch-site': 'same-site' })), false)
  assert.equal(origineAutorisee(requete({ origin: 'https://evil.test', host: 'app.test' })), false)
  assert.equal(origineAutorisee(requete({ origin: 'https://app.test', host: 'app.test' })), true)
  assert.equal(origineAutorisee(requete({})), true)
})

// ————————————————————————————————————————————————
// Proxy vers la base : liste fermée de chemins
// ————————————————————————————————————————————————

test('le proxy n accepte qu une table ou une fonction listee', () => {
  assert.equal(cheminProxyAutorise(['rest', 'v1', 'workout_sets']), 'rest/v1/workout_sets')
  assert.equal(cheminProxyAutorise(['rest', 'v1', 'rpc', 'classement_semaines']), 'rest/v1/rpc/classement_semaines')
  assert.equal(cheminProxyAutorise(['rest', 'v1', 'rpc', 'stockage_octets_utilises']), null)
})

test('les chemins pieges sont refuses', () => {
  assert.equal(cheminProxyAutorise(['rest', 'v1', '..', '..', 'auth', 'v1', 'admin']), null)
  assert.equal(cheminProxyAutorise(['rest', 'v1', 'workout_sets/../../auth']), null)
  assert.equal(cheminProxyAutorise(['rest', 'v1', 'workout_sets', 'x']), null)
  assert.equal(cheminProxyAutorise(['auth', 'v1', 'user']), null)
  assert.equal(cheminProxyAutorise([]), null)
})
