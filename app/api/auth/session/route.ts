import { NextRequest, NextResponse } from 'next/server'
import {
  applySessionCookies,
  clearSessionCookies,
  fetchUser,
  getAccessToken,
} from '@/lib/server/auth-session'
import { clientIp } from '@/lib/server/rate-limit'
import { limiterMemoire } from '@/lib/server/memory-rate-limit'

export const dynamic = 'force-dynamic'

// Débit brut, en mémoire locale à l'instance — voir
// lib/server/memory-rate-limit.ts pour les limites de cette approche.
const LIMITE_DEBIT_PAR_IP = 10

/**
 * État de session pour le front : renvoie l'utilisateur connecté (id/email)
 * d'après les cookies httpOnly, sans jamais exposer les jetons au JavaScript.
 */
export async function GET(req: NextRequest) {
  const debit = limiterMemoire(`auth:${clientIp(req)}`, LIMITE_DEBIT_PAR_IP, 60_000)
  if (debit.bloque) {
    return NextResponse.json(
      { error: 'Trop de requêtes' },
      { status: 429, headers: { 'Retry-After': String(debit.retryAfterSeconds) } }
    )
  }

  const auth = await getAccessToken(req)
  if (!auth) return NextResponse.json({ user: null }, { status: 401 })

  const user = await fetchUser(auth.accessToken)
  if (!user) {
    // Jeton invalide/révoqué : on nettoie pour ne pas boucler sur un cookie mort
    const res = NextResponse.json({ user: null }, { status: 401 })
    clearSessionCookies(res)
    return res
  }

  const res = NextResponse.json({ user })
  if (auth.refreshed) applySessionCookies(res, auth.refreshed)
  return res
}
