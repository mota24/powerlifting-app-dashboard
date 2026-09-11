import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookies, compteConnecte, origineAutorisee } from '@/lib/server/auth-session'
import { clientIp } from '@/lib/server/rate-limit'
import { limiterMemoire } from '@/lib/server/memory-rate-limit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { signatureImage } from '@/lib/photos'

export const dynamic = 'force-dynamic'

const BUCKET = 'competition-photos'
const MAX_SIZE = 5 * 1024 * 1024
const MAX_FILES = 10
const LIMITE_PAR_MINUTE = 20
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Type réel d'après les premiers octets : le type annoncé par le navigateur ne prouve rien. */
function typeReel(octets: Uint8Array): string | null {
  if (SIGNATURE_PNG.every((octet, i) => octets[i] === octet)) return 'image/png'
  return signatureImage(octets)
}

/**
 * Upload des photos d'une compétition (une ou plusieurs par requête).
 * Le navigateur n'a jamais la clé service_role : il envoie les fichiers
 * ici, la route vérifie la session (cookie httpOnly) puis écrit dans
 * Supabase Storage sous le dossier du compte connecté — jamais fourni par
 * le client, toujours dérivé de son e-mail authentifié.
 */
export async function POST(req: NextRequest) {
  if (!origineAutorisee(req)) return NextResponse.json({ error: 'Origine refusée' }, { status: 403 })
  const verdict = limiterMemoire(`palmares:${clientIp(req)}`, LIMITE_PAR_MINUTE, 60_000)
  if (verdict.bloque) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } })
  }
  const session = await compteConnecte(req)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const files = (form?.getAll('file') ?? []).filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `${MAX_FILES} photos maximum par envoi` }, { status: 400 })
  }

  const lus: { octets: ArrayBuffer; type: string }[] = []
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `« ${file.name.slice(0, 80)} » dépasse 5 Mo` }, { status: 400 })
    }
    const octets = await file.arrayBuffer()
    const type = typeReel(new Uint8Array(octets))
    if (!type) {
      return NextResponse.json({ error: 'Format non supporté (JPEG, PNG ou WebP uniquement)' }, { status: 400 })
    }
    lus.push({ octets, type })
  }

  const stockage = getSupabaseAdmin().storage.from(BUCKET)
  const urls: string[] = []
  for (const { octets, type } of lus) {
    const path = `${session.compte}/${crypto.randomUUID()}.${EXTENSIONS[type]}`
    const { error } = await stockage.upload(path, octets, { contentType: type, upsert: false })
    if (error) {
      return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 })
    }
    urls.push(stockage.getPublicUrl(path).data.publicUrl)
  }

  const res = NextResponse.json({ urls })
  if (session.refreshed) applySessionCookies(res, session.refreshed)
  return res
}
