import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Limiteur de tentatives (anti force brute) à deux couches :
//  - mémoire du processus : toujours active, protège immédiatement une
//    instance donnée (dev, serveur unique, lambda chaude) ;
//  - table Supabase auth_failed_attempts : partagée entre toutes les
//    instances serverless — nécessite d'exécuter
//    supabase/migration_rate_limit.sql (sinon cette couche est ignorée).
// Fenêtre glissante : un échec « expire » 15 minutes après avoir eu lieu.

export const WINDOW_MINUTES = 15
const WINDOW_MS = WINDOW_MINUTES * 60 * 1000

export interface RateCheck {
  key: string
  limit: number
}

export interface RateVerdict {
  blocked: boolean
  retryAfterSeconds: number
}

const memory = new Map<string, number[]>()
let warnedMissingTable = false

export function clientIp(req: NextRequest): string {
  // Derrière Vercel/un proxy, la première valeur de x-forwarded-for est le client
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'inconnue'
}

function verdictFromTimestamps(timestamps: number[], limit: number): RateVerdict {
  const now = Date.now()
  const recent = timestamps.filter((t) => now - t < WINDOW_MS).sort((a, b) => b - a)
  if (recent.length < limit) return { blocked: false, retryAfterSeconds: 0 }
  // Le blocage se lève quand le N-ième échec le plus récent sort de la fenêtre
  const nth = recent[limit - 1]
  return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((nth + WINDOW_MS - now) / 1000)) }
}

/** Bloqué si N'IMPORTE QUELLE clé dépasse sa limite, sur l'une ou l'autre couche. */
export async function checkRateLimit(checks: RateCheck[]): Promise<RateVerdict> {
  let retryAfterSeconds = 0

  for (const check of checks) {
    const verdict = verdictFromTimestamps(memory.get(check.key) ?? [], check.limit)
    if (verdict.blocked) retryAfterSeconds = Math.max(retryAfterSeconds, verdict.retryAfterSeconds)
  }

  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const { data, error } = await getSupabaseAdmin()
      .from('auth_failed_attempts')
      .select('identifier, created_at')
      .in('identifier', checks.map((c) => c.key))
      .gte('created_at', since)
    if (error) throw error
    for (const check of checks) {
      const timestamps = (data ?? [])
        .filter((row) => row.identifier === check.key)
        .map((row) => new Date(row.created_at as string).getTime())
      const verdict = verdictFromTimestamps(timestamps, check.limit)
      if (verdict.blocked) retryAfterSeconds = Math.max(retryAfterSeconds, verdict.retryAfterSeconds)
    }
  } catch (e) {
    if (!warnedMissingTable) {
      warnedMissingTable = true
      console.warn(
        'rate-limit : couche base indisponible (exécuter supabase/migration_rate_limit.sql ?) — seule la couche mémoire est active.',
        e instanceof Error ? e.message : e
      )
    }
  }

  return retryAfterSeconds > 0 ? { blocked: true, retryAfterSeconds } : { blocked: false, retryAfterSeconds: 0 }
}

export async function recordFailure(keys: string[]): Promise<void> {
  const now = Date.now()
  for (const key of keys) {
    const list = (memory.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
    list.push(now)
    memory.set(key, list)
  }
  // Garde-fou mémoire : purge des clés dont tous les échecs ont expiré
  if (memory.size > 10_000) {
    for (const [key, list] of memory) {
      if (list.every((t) => now - t >= WINDOW_MS)) memory.delete(key)
    }
  }

  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('auth_failed_attempts').insert(keys.map((key) => ({ identifier: key })))
    if (error) throw error
    // Nettoyage opportuniste des échecs expirés (trafic faible : coût négligeable)
    await admin.from('auth_failed_attempts').delete().lt('created_at', new Date(now - 2 * WINDOW_MS).toISOString())
  } catch { /* couche base absente : la couche mémoire a déjà enregistré */ }
}

/** Après une connexion réussie, on remet le compteur du compte à zéro. */
export async function clearFailures(keys: string[]): Promise<void> {
  for (const key of keys) memory.delete(key)
  try {
    await getSupabaseAdmin().from('auth_failed_attempts').delete().in('identifier', keys)
  } catch { /* idem : silencieux si la table n'existe pas encore */ }
}
