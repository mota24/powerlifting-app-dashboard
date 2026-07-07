import { NextRequest, NextResponse } from 'next/server'
import {
  applySessionCookies,
  clearSessionCookies,
  fetchUser,
  getAccessToken,
} from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

/**
 * État de session pour le front : renvoie l'utilisateur connecté (id/email)
 * d'après les cookies httpOnly, sans jamais exposer les jetons au JavaScript.
 */
export async function GET(req: NextRequest) {
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
