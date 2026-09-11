import { NextRequest, NextResponse } from 'next/server'

// Session Supabase stockée dans des cookies httpOnly + secure : le JavaScript
// du navigateur ne peut plus lire les jetons (protection contre le vol par XSS).
// Ce module est le seul endroit qui manipule les jetons — strictement serveur.
if (typeof window !== 'undefined') {
  throw new Error('auth-session ne doit JAMAIS être importé côté client')
}

export const ACCESS_COOKIE = 'pl-access-token'
export const REFRESH_COOKIE = 'pl-refresh-token'

const isProd = process.env.NODE_ENV === 'production'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthUser {
  id: string
  email: string | null
}

interface GoTrueSession {
  access_token: string
  refresh_token: string
  expires_in: number
  user: { id: string; email?: string | null }
}

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes')
  }
  return { url, anonKey }
}

export function applySessionCookies(res: NextResponse, tokens: SessionTokens) {
  const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' }
  // Marge de 60 s : le cookie d'accès disparaît AVANT l'expiration du JWT,
  // le proxy rafraîchit alors via le refresh token au lieu d'envoyer un jeton périmé.
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: Math.max(60, tokens.expiresIn - 60),
  })
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function clearSessionCookies(res: NextResponse) {
  const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', maxAge: 0 }
  res.cookies.set(ACCESS_COOKIE, '', base)
  res.cookies.set(REFRESH_COOKIE, '', base)
}

export function toSessionTokens(session: GoTrueSession): SessionTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
  }
}

async function goTrueToken(grant: 'password' | 'refresh_token', body: Record<string, string>) {
  const { url, anonKey } = supabaseEnv()
  const res = await fetch(`${url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as GoTrueSession
}

export function signInWithPassword(email: string, password: string) {
  return goTrueToken('password', { email, password })
}

export function refreshSession(refreshToken: string) {
  return goTrueToken('refresh_token', { refresh_token: refreshToken })
}

/** Valide le jeton auprès de Supabase et renvoie l'utilisateur associé. */
export async function fetchUser(accessToken: string): Promise<AuthUser | null> {
  const { url, anonKey } = supabaseEnv()
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string; email?: string | null }
  return user?.id ? { id: user.id, email: user.email ?? null } : null
}

/** Révoque la session côté Supabase (invalide les refresh tokens). */
export async function revokeSession(accessToken: string) {
  const { url, anonKey } = supabaseEnv()
  await fetch(`${url}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }).catch(() => {})
}

/**
 * Extrait un jeton d'accès valide des cookies httpOnly de la requête, en le
 * rafraîchissant si nécessaire. Quand `refreshed` est non nul, l'appelant doit
 * le ré-appliquer à sa réponse via applySessionCookies.
 */
export async function getAccessToken(
  req: NextRequest
): Promise<{ accessToken: string; refreshed: SessionTokens | null } | null> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value
  if (access) return { accessToken: access, refreshed: null }

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value
  if (!refresh) return null
  const session = await refreshSession(refresh)
  if (!session) return null
  return { accessToken: session.access_token, refreshed: toSessionTokens(session) }
}

/**
 * Comptes de l'app : identifiant « 1 » ↔ e-mail « 1@power.app ».
 * L'identité d'un compte est l'e-mail COMPLET, jamais son préfixe seul : un
 * compte inscrit sur un autre domaine (« 1@ailleurs.com ») n'obtient rien.
 */
export const DOMAINE_COMPTES = 'power.app'
const MOTIF_IDENTIFIANT = /^[a-z0-9_-]{1,64}$/

/** « 1 » → « 1@power.app » ; null si l'identifiant n'a pas la forme attendue. */
export function emailDuCompte(identifiant: string): string | null {
  const id = identifiant.trim().toLowerCase()
  return MOTIF_IDENTIFIANT.test(id) ? `${id}@${DOMAINE_COMPTES}` : null
}

/** « 1@power.app » → « 1 » ; null pour tout autre domaine ou toute autre forme. */
export function compteDepuisEmail(email: string | null | undefined): string | null {
  const [local = '', domaine, ...reste] = (email ?? '').toLowerCase().split('@')
  return reste.length === 0 && domaine === DOMAINE_COMPTES && MOTIF_IDENTIFIANT.test(local) ? local : null
}

/**
 * E-mail porté par un jeton d'accès, lu SANS vérifier sa signature : ne sert
 * qu'à refuser tôt, sans appel réseau. Un jeton forgé est de toute façon
 * rejeté par Supabase à l'étape suivante.
 */
export function emailDuJeton(accessToken: string): string | null {
  const charge = accessToken.split('.')[1]
  if (!charge) return null
  try {
    const { email } = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8')) as { email?: unknown }
    return typeof email === 'string' ? email : null
  } catch {
    return null
  }
}

/**
 * Protection CSRF en profondeur, en plus des cookies SameSite=Lax : une requête
 * qui modifie des données doit venir de l'app elle-même. Sans en-tête de
 * provenance (outil en ligne de commande), rien à usurper : les cookies de la
 * victime ne partent pas avec.
 */
export function origineAutorisee(req: NextRequest): boolean {
  const site = req.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin' || site === 'none'
  const origine = req.headers.get('origin')
  if (!origine) return true
  try {
    return new URL(origine).host === req.headers.get('host')
  } catch {
    return false
  }
}

/** Session d'un compte DE L'APP : jeton valide et e-mail en @power.app, sinon null. */
export async function compteConnecte(req: NextRequest): Promise<{
  compte: string
  user: AuthUser
  accessToken: string
  refreshed: SessionTokens | null
} | null> {
  const auth = await getAccessToken(req)
  // Jeton d'un autre domaine : refusé avant tout appel réseau.
  if (!auth || !compteDepuisEmail(emailDuJeton(auth.accessToken))) return null
  const user = await fetchUser(auth.accessToken)
  const compte = compteDepuisEmail(user?.email)
  return user && compte ? { compte, user, accessToken: auth.accessToken, refreshed: auth.refreshed } : null
}
