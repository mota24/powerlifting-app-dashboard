import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_COOKIE, clearSessionCookies, revokeSession } from '@/lib/server/auth-session'
import { clientIp } from '@/lib/server/rate-limit'
import { limiterMemoire } from '@/lib/server/memory-rate-limit'

export const dynamic = 'force-dynamic'

// Débit brut, en mémoire locale à l'instance — voir
// lib/server/memory-rate-limit.ts pour les limites de cette approche.
const LIMITE_DEBIT_PAR_IP = 10

/** Déconnexion : révoque la session côté Supabase et efface les cookies httpOnly. */
export async function POST(req: NextRequest) {
  const debit = limiterMemoire(`auth:${clientIp(req)}`, LIMITE_DEBIT_PAR_IP, 60_000)
  if (debit.bloque) {
    return NextResponse.json(
      { error: 'Trop de requêtes' },
      { status: 429, headers: { 'Retry-After': String(debit.retryAfterSeconds) } }
    )
  }

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value
  if (accessToken) await revokeSession(accessToken)

  const res = NextResponse.json({ success: true })
  clearSessionCookies(res)
  return res
}
