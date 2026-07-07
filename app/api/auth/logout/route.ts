import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_COOKIE, clearSessionCookies, revokeSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

/** Déconnexion : révoque la session côté Supabase et efface les cookies httpOnly. */
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value
  if (accessToken) await revokeSession(accessToken)

  const res = NextResponse.json({ success: true })
  clearSessionCookies(res)
  return res
}
