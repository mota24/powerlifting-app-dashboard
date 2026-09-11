import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookies, emailDuCompte, origineAutorisee, signInWithPassword, toSessionTokens } from '@/lib/server/auth-session'
import { checkRateLimit, clearFailures, clientIp, recordFailure } from '@/lib/server/rate-limit'
import { limiterMemoire } from '@/lib/server/memory-rate-limit'

export const dynamic = 'force-dynamic'

// Anti force brute : 5 échecs / 15 min par identifiant (cible un compte
// précis) et 20 échecs / 15 min par IP (pulvérisation sur plusieurs comptes).
// Couche partagée entre instances (table Supabase) — compte les ÉCHECS
// uniquement, précision voulue pour ce rôle.
const LIMIT_PER_IDENTIFIANT = 5
const LIMIT_PER_IP = 20

// Plafond de débit brut (succès ET échecs confondus), en mémoire locale à
// l'instance : voir lib/server/memory-rate-limit.ts pour les limites de
// cette approche. Filtre le gros du bruit avant même de solliciter la
// couche partagée ci-dessus.
const LIMITE_DEBIT_PAR_IP = 10

const ECHEC = 'Identifiant ou mot de passe incorrect'

/**
 * Connexion : vérifie les identifiants auprès de Supabase côté serveur puis
 * dépose les jetons dans des cookies httpOnly + secure. Le navigateur ne
 * reçoit jamais les jetons en clair — seul l'utilisateur (id/email) est renvoyé.
 */
export async function POST(req: NextRequest) {
  if (!origineAutorisee(req)) return NextResponse.json({ error: 'Origine refusée' }, { status: 403 })
  const debit = limiterMemoire(`auth:${clientIp(req)}`, LIMITE_DEBIT_PAR_IP, 60_000)
  if (debit.bloque) {
    return NextResponse.json(
      { error: 'Trop de requêtes' },
      { status: 429, headers: { 'Retry-After': String(debit.retryAfterSeconds) } }
    )
  }

  const body = (await req.json().catch(() => null)) as { identifiant?: unknown; password?: unknown } | null
  const identifiant = typeof body?.identifiant === 'string' ? body.identifiant.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!identifiant || !password) {
    return NextResponse.json({ error: 'Identifiant et mot de passe requis' }, { status: 400 })
  }
  // Identifiant de forme impossible (« x@autre.com », espaces…) : même réponse
  // qu'un mauvais mot de passe, pour ne rien révéler sur les comptes existants.
  const email = emailDuCompte(identifiant)
  if (!email) return NextResponse.json({ error: ECHEC }, { status: 401 })

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

  const session = await signInWithPassword(email, password)
  if (!session) {
    await recordFailure([keyIdentifiant, keyIp])
    return NextResponse.json({ error: ECHEC }, { status: 401 })
  }
  await clearFailures([keyIdentifiant])

  const res = NextResponse.json({
    user: { id: session.user.id, email: session.user.email ?? null },
  })
  applySessionCookies(res, toSessionTokens(session))
  return res
}
