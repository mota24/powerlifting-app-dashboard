import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookies, fetchUser, getAccessToken, type SessionTokens } from '@/lib/server/auth-session'
import { clientIp } from '@/lib/server/rate-limit'
import { limiterMemoire } from '@/lib/server/memory-rate-limit'

/** Outils communs aux routes /api/photos : stockage, session, réponses. */

export const BUCKET_PHOTOS = 'photos-seances'
export const TABLE_PHOTOS = 'photos_seance'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Galerie, séance, envois un par un et enregistrements : large pour l'usage réel.
const LIMITE_PAR_MINUTE = 60

export function limiterPhotos(req: NextRequest) {
  const verdict = limiterMemoire(`photos:${clientIp(req)}`, LIMITE_PAR_MINUTE, 60_000)
  if (!verdict.bloque) return null
  return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } })
}

export async function compteConnecte(req: NextRequest): Promise<{ compte: string; refreshed: SessionTokens | null } | null> {
  const auth = await getAccessToken(req)
  if (!auth) return null
  const user = await fetchUser(auth.accessToken)
  const compte = user?.email?.split('@')[0] ?? ''
  // Le compte sert de dossier dans le stockage : aucun caractère de chemin.
  return /^[A-Za-z0-9_-]{1,64}$/.test(compte) ? { compte, refreshed: auth.refreshed } : null
}

/** Ré-applique à la réponse la session rafraîchie, s'il y en a une. */
export function avecSession<T extends NextResponse>(res: T, refreshed: SessionTokens | null): T {
  if (refreshed) applySessionCookies(res, refreshed)
  return res
}

export function repondre(corps: object, status: number, refreshed: SessionTokens | null) {
  return avecSession(NextResponse.json(corps, { status, headers: { 'Cache-Control': 'private, no-store' } }), refreshed)
}

/** Table pas encore créée (migration non lancée). */
export function tableAbsente(erreur: { code?: string } | null, status?: number) {
  return erreur?.code === 'PGRST205' || erreur?.code === '42P01' || status === 404
}
