import { NextRequest, NextResponse } from 'next/server'
import {
  applySessionCookies,
  fetchUser,
  getAccessToken,
  signInWithPassword,
  toSessionTokens,
} from '@/lib/server/auth-session'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { pwnedCount, validatePasswordStrength } from '@/lib/server/password-policy'
import { checkRateLimit, clearFailures, clientIp, recordFailure } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

// La vérification du mot de passe actuel est une cible de force brute au même
// titre que la connexion : mêmes limites que /api/auth/login.
const LIMIT_PER_COMPTE = 5
const LIMIT_PER_IP = 20

/**
 * Changement de mot de passe. Toute la politique est appliquée côté serveur :
 * session valide (cookie httpOnly) + mot de passe actuel exigés, puis règles
 * de robustesse et refus des mots de passe fuités (Have I Been Pwned).
 */
export async function POST(req: NextRequest) {
  const auth = await getAccessToken(req)
  const user = auth ? await fetchUser(auth.accessToken) : null
  if (!auth || !user?.email) {
    return NextResponse.json({ error: 'Session expirée : reconnecte-toi' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { currentPassword?: unknown; newPassword?: unknown } | null
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Mot de passe actuel et nouveau mot de passe requis' }, { status: 400 })
  }

  const keyCompte = `pwd:${user.id}`
  const keyIp = `ip:${clientIp(req)}`
  const gate = await checkRateLimit([
    { key: keyCompte, limit: LIMIT_PER_COMPTE },
    { key: keyIp, limit: LIMIT_PER_IP },
  ])
  if (gate.blocked) {
    const minutes = Math.max(1, Math.ceil(gate.retryAfterSeconds / 60))
    return NextResponse.json(
      { error: `Trop de tentatives échouées. Réessaie dans ${minutes} min.` },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfterSeconds) } }
    )
  }

  // 1. Preuve de possession : le mot de passe actuel doit être connu
  const verification = await signInWithPassword(user.email, currentPassword)
  if (!verification) {
    await recordFailure([keyCompte, keyIp])
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 })
  }

  // 2. Règles de robustesse
  const manques = validatePasswordStrength(newPassword)
  if (manques.length > 0) {
    return NextResponse.json(
      { error: `Mot de passe trop faible — il faut : ${manques.join(', ')}.` },
      { status: 400 }
    )
  }

  // 3. Refus des mots de passe déjà fuités (HIBP, k-anonymat).
  //    Service injoignable = on refuse de valider sans contrôle (fail-closed) :
  //    mieux vaut réessayer dans une minute qu'accepter un mot de passe compromis.
  const fuites = await pwnedCount(newPassword)
  if (fuites === null) {
    return NextResponse.json(
      { error: 'Vérification des fuites de données momentanément indisponible — réessaie dans un instant.' },
      { status: 503 }
    )
  }
  if (fuites > 0) {
    return NextResponse.json(
      { error: `Ce mot de passe est apparu ${fuites.toLocaleString('fr-FR')} fois dans des fuites de données publiques : choisis-en un autre.` },
      { status: 400 }
    )
  }

  // 4. Mise à jour via l'API admin (service_role, jamais exposée au client)
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (error) {
    return NextResponse.json({ error: 'Impossible de mettre à jour le mot de passe' }, { status: 500 })
  }

  await clearFailures([keyCompte])

  // Le changement de mot de passe détruit les sessions existantes côté
  // Supabase : on en ouvre une neuve avec le nouveau mot de passe pour que
  // l'utilisateur reste connecté (nouveaux cookies httpOnly).
  const res = NextResponse.json({ success: true })
  const nouvelleSession = await signInWithPassword(user.email, newPassword)
  if (nouvelleSession) applySessionCookies(res, toSessionTokens(nouvelleSession))
  return res
}
