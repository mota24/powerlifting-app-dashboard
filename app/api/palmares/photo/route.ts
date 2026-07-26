import { NextRequest, NextResponse } from 'next/server'
import { fetchUser, getAccessToken } from '@/lib/server/auth-session'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'competition-photos'
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Upload de la photo d'une compétition. Le navigateur n'a jamais la clé
 * service_role : il envoie le fichier ici, la route vérifie la session
 * (cookie httpOnly) puis écrit dans Supabase Storage sous un chemin
 * préfixé par l'identifiant de l'utilisateur connecté (jamais fourni
 * par le client, dérivé de son email authentifié).
 */
export async function POST(req: NextRequest) {
  const auth = await getAccessToken(req)
  const user = auth ? await fetchUser(auth.accessToken) : null
  if (!auth || !user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (5 Mo max)' }, { status: 400 })
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Format non supporté (JPEG, PNG ou WebP uniquement)' }, { status: 400 })
  }

  const syncUserId = user.email.split('@')[0]
  const path = `${syncUserId}/${crypto.randomUUID()}.${ext}`

  const admin = getSupabaseAdmin()
  const buffer = await file.arrayBuffer()
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 })
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
