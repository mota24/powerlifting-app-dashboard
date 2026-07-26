import { NextRequest, NextResponse } from 'next/server'
import { fetchUser, getAccessToken } from '@/lib/server/auth-session'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'competition-photos'
const MAX_SIZE = 5 * 1024 * 1024
const MAX_FILES = 10
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Upload des photos d'une compétition (une ou plusieurs par requête).
 * Le navigateur n'a jamais la clé service_role : il envoie les fichiers
 * ici, la route vérifie la session (cookie httpOnly) puis écrit dans
 * Supabase Storage sous un chemin préfixé par l'identifiant de
 * l'utilisateur connecté — jamais fourni par le client, toujours dérivé
 * de son email authentifié.
 */
export async function POST(req: NextRequest) {
  const auth = await getAccessToken(req)
  const user = auth ? await fetchUser(auth.accessToken) : null
  if (!auth || !user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  const files = (form?.getAll('file') ?? []).filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `${MAX_FILES} photos maximum par envoi` }, { status: 400 })
  }
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `« ${file.name} » dépasse 5 Mo` }, { status: 400 })
    }
    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json({ error: 'Format non supporté (JPEG, PNG ou WebP uniquement)' }, { status: 400 })
    }
  }

  const syncUserId = user.email.split('@')[0]
  const admin = getSupabaseAdmin()
  const urls: string[] = []

  for (const file of files) {
    const path = `${syncUserId}/${crypto.randomUUID()}.${ALLOWED_TYPES[file.type]}`
    const { error } = await admin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 })
    }
    urls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
  }

  return NextResponse.json({ urls })
}
