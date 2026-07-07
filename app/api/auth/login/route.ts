import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookies, signInWithPassword, toSessionTokens } from '@/lib/server/auth-session'
import { checkRateLimit, clearFailures, clientIp, recordFailure } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

// Anti force brute : 5 échecs / 15 min par identifiant (cible un compte
// précis) et 20 échecs / 15 min par IP (pulvérisation sur plusieurs comptes).
const LIMIT_PER_IDENTIFIANT = 5
const LIMIT_PER_IP = 20

/**
 * Connexion : vérifie les identifiants auprès de Supabase côté serveur puis
 * dépose les jetons dans des cookies httpOnly + secure. Le navigateur ne
 * reçoit jamais les jetons en clair — seul l'utilisateur (id/email) est renvoyé.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { identifiant?: unknown; password?: unknown } | null
  const identifiant = typeof body?.identifiant === 'string' ? body.identifiant.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!identifiant || !password) {
    return NextResponse.json({ error: 'Identifiant et mot de passe requis' }, { status: 400 })
  }

  const keyIdentifiant = `id:${identifiant}`
  const keyIp = `ip:${clientIp(req)}`
  const gate = await checkRateLimit([
    { key: keyIdentifiant, limit: LIMIT_PER_IDENTIFIANT },
    { key: keyIp, limit: LIMIT_PER_IP },
  ])
  if (gate.blocked) {
    const minutes = Math.max(1, Math.ceil(gate.retryAfterSeconds / 60))
    return NextResponse.json(
      { error: `Trop de tentatives échouées. Réessaie dans ${minutes} min.` },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfterSeconds) } }
    )
  }

  // Email fantôme : même convention qu'avant (identifiant → identifiant@power.app),
  // mais construit côté serveur.
  const session = await signInWithPassword(`${identifiant}@power.app`, password)
  if (!session) {
    await recordFailure([keyIdentifiant, keyIp])
    return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 })
  }
  await clearFailures([keyIdentifiant])

  const res = NextResponse.json({
    user: { id: session.user.id, email: session.user.email ?? null },
  })
  applySessionCookies(res, toSessionTokens(session))
  return res
}
