import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client admin (service_role) : contourne RLS.
// STRICTEMENT réservé aux routes API serveur, jamais importé côté client.
if (typeof window !== 'undefined') {
  throw new Error('supabase-admin ne doit JAMAIS être importé côté client')
}

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante dans les variables d’environnement')
    }
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}
