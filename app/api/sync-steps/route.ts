import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * Synchronisation des pas depuis l'iPhone (raccourci Apple Shortcuts).
 * Idempotente : un seul enregistrement par (user, jour), toujours la dernière valeur.
 * Le raccourci peut donc être déclenché plusieurs fois par jour sans doublon.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  // Secret accepté en query param (simplicité Shortcuts) ou en header
  const secret = searchParams.get('secretKey') ?? req.headers.get('x-sync-secret')
  if (!process.env.SYNC_SECRET || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const steps = Number.parseInt(searchParams.get('steps') ?? '', 10)
  const userId = searchParams.get('userId')?.trim()
  if (!userId || !Number.isFinite(steps) || steps < 0 || steps > 200_000) {
    return NextResponse.json({ error: 'Paramètres invalides (userId, steps requis)' }, { status: 400 })
  }

  // Date du jour au fuseau français ('en-CA' produit nativement YYYY-MM-DD)
  const dateFrancaise = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

  try {
    const { error } = await getSupabaseAdmin()
      .from('seances_pas')
      .upsert(
        { user_id: userId, date: dateFrancaise, pas: steps },
        { onConflict: 'user_id,date' }
      )

    if (error) {
      console.error('Erreur Supabase (sync-steps):', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      date_enregistree: dateFrancaise,
      pas_enregistres: steps,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
