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
