import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookies, fetchUser, getAccessToken, type SessionTokens } from '@/lib/server/auth-session'
import { clientIp } from '@/lib/server/rate-limit'
import { limiterMemoire } from '@/lib/server/memory-rate-limit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  COTE_MAX_PX,
  EXTENSIONS,
  OCTETS_MAX_MINI,
  OCTETS_MAX_PHOTO,
  PHOTOS_MAX_PAR_JOUR,
  dateValide,
  signatureImage,
  type PhotoSeance,
} from '@/lib/photos'

export const dynamic = 'force-dynamic'

/**
 * Photos de séance — des photos de corps, donc strictement privées.
 *
 * Le bucket `photos-seances` est privé et la table `photos_seance` n'a aucune
 * policy : ni le navigateur ni le proxy /api/db n'y accèdent. Seule cette
 * route y touche, avec la clé service_role, et toujours sous le compte dérivé
 * de la session, jamais d'un paramètre envoyé par le client. Le navigateur ne
 * reçoit que des liens signés valables une heure.
 */

const BUCKET = 'photos-seances'
const TABLE = 'photos_seance'
const DUREE_LIEN_S = 60 * 60
// Galerie, séance et envois un par un : large pour l'usage réel.
const LIMITE_PAR_MINUTE = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LignePhoto {
  id: string
  date: string
  chemin: string
  chemin_mini: string
  largeur: number
  hauteur: number
  octets: number
}

function limiter(req: NextRequest) {
  const verdict = limiterMemoire(`photos:${clientIp(req)}`, LIMITE_PAR_MINUTE, 60_000)
  if (!verdict.bloque) return null
  return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } })
}

async function compteConnecte(req: NextRequest): Promise<{ compte: string; refreshed: SessionTokens | null } | null> {
  const auth = await getAccessToken(req)
  if (!auth) return null
  const user = await fetchUser(auth.accessToken)
  const compte = user?.email?.split('@')[0] ?? ''
  // Le compte sert de dossier dans le stockage : aucun caractère de chemin.
  return /^[A-Za-z0-9_-]{1,64}$/.test(compte) ? { compte, refreshed: auth.refreshed } : null
}

function repondre(corps: object, status: number, refreshed: SessionTokens | null) {
  const res = NextResponse.json(corps, { status, headers: { 'Cache-Control': 'private, no-store' } })
  if (refreshed) applySessionCookies(res, refreshed)
  return res
}

/** Table pas encore créée (migration non lancée). */
function tableAbsente(erreur: { code?: string } | null, status?: number) {
  return erreur?.code === 'PGRST205' || erreur?.code === '42P01' || status === 404
}

async function avecLiens(lignes: LignePhoto[]): Promise<PhotoSeance[] | null> {
  if (lignes.length === 0) return []
  const chemins = lignes.flatMap((l) => [l.chemin, l.chemin_mini])
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrls(chemins, DUREE_LIEN_S)
  if (error || !data) return null
  const liens = new Map(data.map((d) => [d.path, d.signedUrl]))
  return lignes.flatMap((l) => {
    const url = liens.get(l.chemin)
    const urlMini = liens.get(l.chemin_mini)
    // Fichier absent du stockage : la photo n'est pas proposée plutôt qu'affichée cassée.
    return url && urlMini ? [{ id: l.id, date: l.date, largeur: l.largeur, hauteur: l.hauteur, octets: l.octets, url, urlMini }] : []
  })
}

/** ?date=YYYY-MM-DD : photos de la séance. Sans date : toute la galerie du compte. */
export async function GET(req: NextRequest) {
  const bloque = limiter(req)
  if (bloque) return bloque
  const session = await compteConnecte(req)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  if (date !== null && !dateValide(date)) return repondre({ error: 'Date invalide' }, 400, session.refreshed)

  let requete = getSupabaseAdmin()
    .from(TABLE)
    .select('id, date, chemin, chemin_mini, largeur, hauteur, octets')
    .eq('user_id', session.compte)
    .order('date', { ascending: false })
    .order('cree_le', { ascending: true })
  requete = date ? requete.eq('date', date) : requete.limit(1000)

  const { data, error, status } = await requete
  if (error) return repondre({ error: 'Photos indisponibles' }, tableAbsente(error, status) ? 503 : 500, session.refreshed)
  const photos = await avecLiens((data ?? []) as LignePhoto[])
  if (!photos) return repondre({ error: 'Photos indisponibles' }, 502, session.refreshed)
  return repondre({ photos }, 200, session.refreshed)
}

/** Une photo déjà compressée par le navigateur, avec sa vignette. */
export async function POST(req: NextRequest) {
  const bloque = limiter(req)
  if (bloque) return bloque
  const session = await compteConnecte(req)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { compte, refreshed } = session

  const form = await req.formData().catch(() => null)
  const date = form?.get('date')
  const photo = form?.get('photo')
  const mini = form?.get('mini')
  const largeur = Number(form?.get('largeur'))
  const hauteur = Number(form?.get('hauteur'))
  const dimensionValide = (n: number) => Number.isInteger(n) && n >= 1 && n <= COTE_MAX_PX
  if (typeof date !== 'string' || !dateValide(date) || !(photo instanceof File) || !(mini instanceof File) || !dimensionValide(largeur) || !dimensionValide(hauteur)) {
    return repondre({ error: 'Envoi invalide' }, 400, refreshed)
  }
  if (photo.size === 0 || photo.size > OCTETS_MAX_PHOTO || mini.size === 0 || mini.size > OCTETS_MAX_MINI) {
    return repondre({ error: 'Photo trop lourde' }, 413, refreshed)
  }
  const [octetsPhoto, octetsMini] = await Promise.all([photo.arrayBuffer(), mini.arrayBuffer()])
  const typePhoto = signatureImage(new Uint8Array(octetsPhoto))
  const typeMini = signatureImage(new Uint8Array(octetsMini))
  if (!typePhoto || !typeMini) return repondre({ error: 'Format non supporté' }, 415, refreshed)

  const admin = getSupabaseAdmin()
  const { count, error: erreurCompte, status } = await admin
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', compte)
    .eq('date', date)
  if (erreurCompte) return repondre({ error: 'Photos indisponibles' }, tableAbsente(erreurCompte, status) ? 503 : 500, refreshed)
  if ((count ?? 0) >= PHOTOS_MAX_PAR_JOUR) return repondre({ error: 'Limite atteinte' }, 409, refreshed)

  const id = crypto.randomUUID()
  const ligne: LignePhoto = {
    id,
    date,
    chemin: `${compte}/${date}/${id}.${EXTENSIONS[typePhoto]}`,
    chemin_mini: `${compte}/${date}/${id}-mini.${EXTENSIONS[typeMini]}`,
    largeur,
    hauteur,
    octets: octetsPhoto.byteLength + octetsMini.byteLength,
  }
  const stockage = admin.storage.from(BUCKET)
  const echec = async (erreur: { message?: string } | null) => {
    await stockage.remove([ligne.chemin, ligne.chemin_mini]).catch(() => null)
    const bucketAbsent = /bucket not found/i.test(erreur?.message ?? '')
    return repondre({ error: "Échec de l'envoi" }, bucketAbsent ? 503 : 500, refreshed)
  }

  const envoi = await stockage.upload(ligne.chemin, octetsPhoto, { contentType: typePhoto, upsert: false })
  if (envoi.error) return echec(envoi.error)
  const envoiMini = await stockage.upload(ligne.chemin_mini, octetsMini, { contentType: typeMini, upsert: false })
  if (envoiMini.error) return echec(envoiMini.error)
  const { error: erreurLigne } = await admin.from(TABLE).insert({ ...ligne, user_id: compte })
  if (erreurLigne) return echec(null)

  const [signee] = (await avecLiens([ligne])) ?? []
  return repondre({ photo: signee ?? null }, 201, refreshed)
}

/** ?id=<uuid> : supprime une photo DU COMPTE CONNECTÉ (fichiers puis index). */
export async function DELETE(req: NextRequest) {
  const bloque = limiter(req)
  if (bloque) return bloque
  const session = await compteConnecte(req)
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { compte, refreshed } = session

  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!UUID.test(id)) return repondre({ error: 'Identifiant invalide' }, 400, refreshed)

  const admin = getSupabaseAdmin()
  // Filtré sur le compte de la session : deviner l'identifiant d'une autre photo ne suffit pas.
  const { data, error } = await admin.from(TABLE).select('chemin, chemin_mini').eq('id', id).eq('user_id', compte).maybeSingle()
  if (error) return repondre({ error: 'Photos indisponibles' }, 500, refreshed)
  if (!data) return repondre({ error: 'Photo introuvable' }, 404, refreshed)

  const { chemin, chemin_mini: cheminMini } = data as { chemin: string; chemin_mini: string }
  const { error: erreurStockage } = await admin.storage.from(BUCKET).remove([chemin, cheminMini])
  if (erreurStockage) return repondre({ error: 'Suppression impossible' }, 500, refreshed)
  const { error: erreurLigne } = await admin.from(TABLE).delete().eq('id', id).eq('user_id', compte)
  if (erreurLigne) return repondre({ error: 'Suppression impossible' }, 500, refreshed)
  return repondre({ ok: true }, 200, refreshed)
}
