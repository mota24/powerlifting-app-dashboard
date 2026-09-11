import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookies, compteConnecte, origineAutorisee, revokeSession } from '@/lib/server/auth-session'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * RGPD Art. 17 (droit à l'effacement). Supprime le COMPTE (utilisateur Supabase)
 * et les données strictement personnelles indexées par identifiant : pas
 * synchronisés depuis l'iPhone, historique de poids de corps et photos de séance.
 *
 * Le compte visé est celui de la session, et seulement pour un e-mail de l'app
 * (identifiant@power.app) : un compte inscrit sur un autre domaine avec le même
 * identifiant ne peut rien effacer d'autre que lui-même.
 */
export async function POST(req: NextRequest) {
  if (!origineAutorisee(req)) return NextResponse.json({ error: 'Origine refusée' }, { status: 403 })
  const session = await compteConnecte(req)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { compte, user, accessToken } = session

  const admin = getSupabaseAdmin()
  await admin.from('seances_pas').delete().eq('user_id', compte)
  await admin.from('bodyweight_logs').delete().eq('user_id', compte)
  // Photos de séance : les fichiers du bucket privé d'abord, puis leur index.
  const { data: photos } = await admin.from('photos_seance').select('chemin, chemin_mini').eq('user_id', compte)
  const chemins = ((photos ?? []) as { chemin: string; chemin_mini: string }[]).flatMap((p) => [p.chemin, p.chemin_mini])
  for (let i = 0; i < chemins.length; i += 1000) {
    await admin.storage.from('photos-seances').remove(chemins.slice(i, i + 1000))
  }
  await admin.from('photos_seance').delete().eq('user_id', compte)

  await admin.auth.admin.deleteUser(user.id).catch(() => { /* déjà supprimé */ })
  await revokeSession(accessToken)

  const res = NextResponse.json({ success: true })
  clearSessionCookies(res)
  return res
}
