import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { EXTENSIONS, limiteConservation, signatureImage } from '@/lib/photos'
import { BUCKET_PHOTOS, TABLE_PHOTOS, UUID, avecSession, compteConnecte, limiterPhotos, repondre } from '@/lib/server/photos'

export const dynamic = 'force-dynamic'

/**
 * ?id=<uuid> : le fichier d'une photo DU COMPTE CONNECTÉ, pour l'enregistrer
 * sur le téléphone. Servi depuis l'app elle-même : la CSP (connect-src 'self')
 * reste fermée à Supabase, et le bucket reste privé.
 */
export async function GET(req: NextRequest) {
  const bloque = limiterPhotos(req)
  if (bloque) return bloque
  const session = await compteConnecte(req)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { compte, refreshed } = session

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!UUID.test(id)) return repondre({ error: 'Identifiant invalide' }, 400, refreshed)

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE_PHOTOS)
    .select('chemin, date')
    .eq('id', id)
    .eq('user_id', compte)
    .gte('cree_le', limiteConservation().toISOString())
    .maybeSingle()
  if (error) return repondre({ error: 'Photos indisponibles' }, 500, refreshed)
  if (!data) return repondre({ error: 'Photo introuvable' }, 404, refreshed)

  const { chemin, date } = data as { chemin: string; date: string }
  const { data: fichier, error: erreurFichier } = await admin.storage.from(BUCKET_PHOTOS).download(chemin)
  if (erreurFichier || !fichier) return repondre({ error: 'Photo introuvable' }, 404, refreshed)

  const octets = new Uint8Array(await fichier.arrayBuffer())
  const type = signatureImage(octets)
  if (!type) return repondre({ error: 'Photo illisible' }, 500, refreshed)

  return avecSession(
    new NextResponse(octets, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="photo-${date}.${EXTENSIONS[type]}"`,
        'Cache-Control': 'private, no-store',
      },
    }),
    refreshed,
  )
}
