import { NextRequest, NextResponse } from 'next/server'
import {
  applySessionCookies,
  getAccessToken,
  refreshSession,
  toSessionTokens,
  REFRESH_COOKIE,
  type SessionTokens,
} from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

// Proxy authentifié vers PostgREST : le client supabase-js du navigateur
// pointe sur /api/db et n'a plus aucun jeton — c'est ici, côté serveur, que
// le jeton est lu depuis le cookie httpOnly puis attaché à la requête.

// En-têtes transmis tels quels (le reste, dont Authorization client, est ignoré)
const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'prefer', 'range', 'accept-profile', 'content-profile', 'x-client-info']
const FORWARD_RESPONSE_HEADERS = ['content-type', 'content-range', 'preference-applied']

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const joined = (path ?? []).join('/')
  // Seul PostgREST est exposé : ni auth, ni storage, ni functions via le proxy
  if (!joined.startsWith('rest/v1/')) {
    return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
  }

  const auth = await getAccessToken(req)
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const target = `${supabaseUrl}/${joined}${req.nextUrl.search}`
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const body = hasBody ? await req.arrayBuffer() : undefined

  const forward = (accessToken: string) => {
    const headers = new Headers()
    for (const name of FORWARD_REQUEST_HEADERS) {
      const value = req.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('apikey', anonKey)
    headers.set('Authorization', `Bearer ${accessToken}`)
    return fetch(target, { method: req.method, headers, body, cache: 'no-store' })
  }

  let refreshed: SessionTokens | null = auth.refreshed
  let upstream = await forward(auth.accessToken)

  // Jeton refusé (expiré ou révoqué entre-temps) : un refresh puis on rejoue une fois
  if (upstream.status === 401 && !refreshed) {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value
    const session = refreshToken ? await refreshSession(refreshToken) : null
    if (session) {
      refreshed = toSessionTokens(session)
      upstream = await forward(session.access_token)
    }
  }

  const headers = new Headers()
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const payload = upstream.status === 204 || req.method === 'HEAD' ? null : await upstream.arrayBuffer()
  const res = new NextResponse(payload, { status: upstream.status, headers })
  if (refreshed) applySessionCookies(res, refreshed)
  return res
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE, proxy as HEAD }
