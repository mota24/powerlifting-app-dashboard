import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const MOTIF_COMPTE = /^[a-z0-9_-]{1,64}$/

/** Comparaison en temps constant : la durée de réponse ne renseigne pas sur le secret. */
function egaux(recu: string, attendu: string): boolean {
  const a = Buffer.from(recu)
  const b = Buffer.from(attendu)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Table jeton → compte, lue depuis SYNC_TOKENS (format "jeton:compte,jeton:compte").
 * Le raccourci envoie un jeton opaque, jamais l'identifiant de compte :
 * celui-ci ne doit pas transiter en clair dans une URL.
 */
function comptePourJeton(jeton: string): string | null {
  const table = process.env.SYNC_TOKENS
  if (!table) return null
  for (const paire of table.split(',')) {
    const separateur = paire.lastIndexOf(':')
    if (separateur < 1) continue
    const compte = paire.slice(separateur + 1).trim()
    if (egaux(paire.slice(0, separateur).trim(), jeton)) return MOTIF_COMPTE.test(compte) ? compte : null
  }
  return null
}

/**
 * Synchronisation des pas depuis l'iPhone (raccourci Apple Shortcuts).
 * Idempotente : un seul enregistrement par (compte, jour), toujours la dernière valeur.
 * Le raccourci peut donc être déclenché plusieurs fois par jour sans doublon.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  // Secret accepté en query param (simplicité Shortcuts) ou en header
  const secret = searchParams.get('secretKey') ?? req.headers.get('x-sync-secret') ?? ''
  const attendu = process.env.SYNC_SECRET
  if (!attendu || !egaux(secret, attendu)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const steps = Number.parseInt(searchParams.get('steps') ?? '', 10)
  const jeton = searchParams.get('userId')?.trim()
  if (!jeton || !Number.isFinite(steps) || steps < 0 || steps > 200_000) {
    return NextResponse.json({ error: 'Paramètres invalides (userId, steps requis)' }, { status: 400 })
  }

  // IDOR : SYNC_SECRET est partagé par les deux téléphones, il prouve
  // seulement qu'on a le droit d'écrire — pas POUR QUI. Le jeton, lui, est
  // propre à un téléphone : c'est lui qui désigne le compte, et un jeton
  // inconnu est refusé plutôt que d'écrire sur un compte arbitraire.
  const userId = comptePourJeton(jeton)
  if (!userId) {
    return NextResponse.json({ error: 'Identifiant non autorisé' }, { status: 403 })
  }

  // Date du jour au fuseau français ('en-CA' produit nativement YYYY-MM-DD)
  const dateFrancaise = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

  try {
    const { error } = await getSupabaseAdmin()
      .from('seances_pas')
      .upsert({ user_id: userId, date: dateFrancaise, pas: steps }, { onConflict: 'user_id,date' })
    if (error) {
      // Détail gardé dans les journaux serveur : jamais renvoyé au téléphone.
      console.error('sync-steps : écriture refusée', error.code)
      return NextResponse.json({ error: 'Écriture impossible' }, { status: 500 })
    }
    return NextResponse.json({ success: true, date_enregistree: dateFrancaise, pas_enregistres: steps })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
