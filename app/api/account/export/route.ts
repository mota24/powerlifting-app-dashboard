import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, fetchUser } from '@/lib/server/auth-session'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * RGPD Art. 15 (droit d'accès) & Art. 20 (portabilité) : exporte toutes les
 * données personnelles de l'utilisateur connecté dans un format structuré et
 * lisible par machine (JSON), téléchargeable.
 */
export async function GET(req: NextRequest) {
  const auth = await getAccessToken(req)
  const user = auth ? await fetchUser(auth.accessToken) : null
  if (!auth || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const syncUserId = user.email?.split('@')[0] ?? null

  const [workouts, blocks, progress, steps] = await Promise.all([
    admin.from('workout_sets').select('*'),
    admin.from('training_blocks').select('*'),
    admin.from('user_progress').select('*'),
    syncUserId
      ? admin.from('seances_pas').select('*').eq('user_id', syncUserId)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const payload = {
    export_genere_le: new Date().toISOString(),
    utilisateur: { id: user.id, identifiant: user.email },
    donnees: {
      seances: workouts.data ?? [],
      blocs: blocks.data ?? [],
      progression: progress.data ?? [],
      pas_quotidiens: steps.data ?? [],
    },
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mes-donnees-powerapp.json"',
      'Cache-Control': 'no-store',
    },
  })
}
