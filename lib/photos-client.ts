import { toast } from '@/components/power/toaster'
import { proposerAnnulation } from '@/lib/annulation'
import { compresserImage, type ImageCompressee } from '@/lib/compression-image'
import type { CleTraduction, Traducteur } from '@/lib/i18n'
import type { EtatStockage, PhotoSeance } from '@/lib/photos'

/**
 * Accès aux photos depuis le navigateur. Tout passe par /api/photos (session
 * en cookie httpOnly) : jamais d'appel direct à Supabase.
 */

export type ErreurPhoto = 'format' | 'limite' | 'plein' | 'indisponible' | 'envoi'

export const MESSAGE_ERREUR: Record<ErreurPhoto, CleTraduction> = {
  format: 'photoIllisible',
  limite: 'photoLimiteJour',
  plein: 'stockagePlein',
  indisponible: 'photosIndisponibles',
  envoi: 'photoEchecEnvoi',
}

// Une photo effacée l'est pour de bon dans le stockage : la suppression n'est
// envoyée qu'après la fenêtre d'annulation (Ctrl+Z, 30 s). Si l'app passe en
// arrière-plan ou se ferme avant, elle part tout de suite.
const DELAI_SUPPRESSION_MS = 35_000
const programmees = new Map<string, ReturnType<typeof setTimeout>>()
let departSuivi = false

async function lire(url: string): Promise<{ photos: PhotoSeance[]; stockage: EtatStockage | null } | 'indisponible'> {
  try {
    const rep = await fetch(url, { cache: 'no-store' })
    if (!rep.ok) return 'indisponible'
    const corps = (await rep.json()) as { photos?: PhotoSeance[]; stockage?: EtatStockage | null }
    // Une photo en attente de suppression reste cachée, même après un rechargement.
    const photos = (corps.photos ?? []).filter((photo) => !programmees.has(photo.id))
    return { photos, stockage: corps.stockage ?? null }
  } catch {
    return 'indisponible'
  }
}

/** Photos d'une séance. */
export async function chargerPhotos(date: string): Promise<PhotoSeance[] | 'indisponible'> {
  const resultat = await lire(`/api/photos?date=${encodeURIComponent(date)}`)
  return resultat === 'indisponible' ? resultat : resultat.photos
}

/** Toutes les photos du compte, et la place occupée par le projet. */
export function chargerGalerie() {
  return lire('/api/photos')
}

/** Compresse puis envoie une photo. 'recharger' : enregistrée, mais sans lien à afficher tout de suite. */
export async function envoyerPhoto(date: string, fichier: File): Promise<PhotoSeance | ErreurPhoto | 'recharger'> {
  let image: ImageCompressee
  try {
    image = await compresserImage(fichier)
  } catch {
    return 'format'
  }
  const corps = new FormData()
  corps.set('date', date)
  corps.set('largeur', String(image.largeur))
  corps.set('hauteur', String(image.hauteur))
  corps.set('photo', image.photo, 'photo')
  corps.set('mini', image.mini, 'mini')
  try {
    const rep = await fetch('/api/photos', { method: 'POST', body: corps })
    if (rep.status === 409) return 'limite'
    if (rep.status === 415) return 'format'
    if (rep.status === 507) return 'plein'
    if (rep.status === 503) return 'indisponible'
    if (!rep.ok) return 'envoi'
    const { photo } = (await rep.json()) as { photo?: PhotoSeance | null }
    return photo ?? 'recharger'
  } catch {
    return 'envoi'
  }
}

function envoyerSuppression(id: string) {
  programmees.delete(id)
  // keepalive : la requête survit à la fermeture de la page.
  void fetch(`/api/photos?id=${encodeURIComponent(id)}`, { method: 'DELETE', keepalive: true }).catch(() => {})
}

function suivreDepart() {
  if (departSuivi || typeof window === 'undefined') return
  departSuivi = true
  const toutEnvoyer = () => {
    for (const [id, minuteur] of [...programmees]) {
      clearTimeout(minuteur)
      envoyerSuppression(id)
    }
  }
  window.addEventListener('pagehide', toutEnvoyer)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') toutEnvoyer()
  })
}

/** Programme la suppression ; la fonction renvoyée l'annule tant qu'elle n'est pas partie. */
function supprimerPlusTard(id: string): () => boolean {
  suivreDepart()
  const existant = programmees.get(id)
  if (existant) clearTimeout(existant)
  programmees.set(id, setTimeout(() => envoyerSuppression(id), DELAI_SUPPRESSION_MS))
  return () => {
    const minuteur = programmees.get(id)
    if (!minuteur) return false
    clearTimeout(minuteur)
    programmees.delete(id)
    return true
  }
}

/** Retire la photo de l'écran tout de suite, avec « Annuler » et Ctrl+Z comme pour le reste. */
export function supprimerAvecAnnulation({ photo, t, retirer, remettre }: {
  photo: PhotoSeance
  t: Traducteur
  retirer: () => void
  remettre: () => void
}) {
  retirer()
  const annulerSuppression = supprimerPlusTard(photo.id)
  proposerAnnulation({
    message: t('photoSupprimee'),
    libelleBouton: t('annuler'),
    annuler: () => {
      if (!annulerSuppression()) {
        toast(t('restaurationImpossible'), 'error')
        return false
      }
      remettre()
      toast(t('restaure'), 'success')
      return true
    },
  })
}
