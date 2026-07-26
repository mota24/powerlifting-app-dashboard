import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, fetchUser, clearSessionCookies, revokeSession } from '@/lib/server/auth-session'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * RGPD Art. 17 (droit à l'effacement). Supprime le COMPTE (utilisateur Supabase)
 * et les données strictement personnelles (pas quotidiens synchronisés depuis
 * l'iPhone et historique de poids de corps, indexés par identifiant).
 *
 * Les tables d'entraînement (workout_sets, training_blocks, user_progress) sont
 * PARTAGÉES entre les comptes autorisés (application mono-athlète) : elles ne
 * sont pas rattachées à un utilisateur unique et sont volontairement conservées.
 * Ce point est documenté dans la politique de confidentialité.
 */
export async function POST(req: NextRequest) {
  const auth = await getAccessToken(req)
  const user = auth ? await fetchUser(auth.accessToken) : null
  if (!auth || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const syncUserId = user.email?.split('@')[0]
  if (syncUserId) {
    await admin.from('seances_pas').delete().eq('user_id', syncUserId)
    await admin.from('bodyweight_logs').delete().eq('user_id', syncUserId)
  }
  await admin.auth.admin.deleteUser(user.id).catch(() => { /* déjà supprimé */ })
  await revokeSession(auth.accessToken)

  const res = NextResponse.json({ success: true })
  clearSessionCookies(res)
  return res
}
