/**
 * Photos de séance : règles partagées par le navigateur (compression) et le
 * serveur (validation).
 *
 * Ce sont des photos de corps. Elles vivent dans un bucket Supabase PRIVÉ :
 * le navigateur n'a jamais d'adresse publique, seulement des liens signés de
 * courte durée délivrés par /api/photos après vérification de la session.
 */

export const PHOTOS_MAX_PAR_JOUR = 6

/** Côté long de la photo gardée : assez net pour comparer un dos d'une semaine à l'autre. */
export const COTE_MAX_PX = 1440
/** Qualités essayées dans l'ordre, jusqu'à passer sous OCTETS_MAX_PHOTO. */
export const QUALITES = [0.72, 0.6, 0.5] as const
/** Vignette des grilles, chargée en premier ; la photo ne l'est qu'à l'ouverture. */
export const COTE_MINI_PX = 360
export const QUALITE_MINI = 0.6

/** Plafonds vérifiés par le serveur. Compressée, une photo pèse d'ordinaire 100 à 300 Ko. */
export const OCTETS_MAX_PHOTO = 1_500_000
export const OCTETS_MAX_MINI = 200_000

export type TypeImage = 'image/webp' | 'image/jpeg'
export const EXTENSIONS: Record<TypeImage, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' }

/**
 * Plafond de TOUT le stockage du projet (photos de séance et de compétition).
 * Le quota gratuit Supabase est de 1 Go, et le dépasser finit par bloquer
 * toute l'app (réponses 402), pas seulement les photos : les envois sont donc
 * refusés avant, à 850 Mo, avec de la marge.
 */
export const PLAFOND_STOCKAGE_OCTETS = 850 * 1024 ** 2
/** Part du plafond à partir de laquelle la galerie prévient que l'espace se remplit. */
export const SEUIL_ALERTE_STOCKAGE = 0.8

export interface EtatStockage {
  utilises: number
  plafond: number
}

export interface PhotoSeance {
  id: string
  /** 'YYYY-MM-DD' */
  date: string
  largeur: number
  hauteur: number
  octets: number
  /** Liens signés, valables une heure. */
  url: string
  urlMini: string
}

/** Dimensions réduites pour que le côté long ne dépasse pas `coteMax` (jamais agrandies). */
export function dimensionsCible(largeur: number, hauteur: number, coteMax: number): { largeur: number; hauteur: number } {
  const plusGrand = Math.max(largeur, hauteur)
  if (!Number.isFinite(plusGrand) || plusGrand <= 0) return { largeur: 0, hauteur: 0 }
  const echelle = Math.min(1, coteMax / plusGrand)
  return { largeur: Math.max(1, Math.round(largeur * echelle)), hauteur: Math.max(1, Math.round(hauteur * echelle)) }
}

/** Date calendaire réelle au format 'YYYY-MM-DD' (refuse par exemple 2026-02-30). */
export function dateValide(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [annee, mois, jour] = date.split('-').map(Number)
  const d = new Date(Date.UTC(annee, mois - 1, jour))
  return d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
}

/** Jours de `a` à `b` (dates 'YYYY-MM-DD'), insensible aux changements d'heure. */
export function joursEntre(a: string, b: string): number {
  const utc = (iso: string) => {
    const [annee, mois, jour] = iso.split('-').map(Number)
    return Date.UTC(annee, mois - 1, jour)
  }
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** Regroupe par mois ('YYYY-MM') en gardant l'ordre de première apparition. */
export function grouperParMois<T extends { date: string }>(photos: T[]): { mois: string; photos: T[] }[] {
  const parMois = new Map<string, T[]>()
  for (const photo of photos) {
    const mois = photo.date.slice(0, 7)
    const liste = parMois.get(mois)
    if (liste) liste.push(photo)
    else parMois.set(mois, [photo])
  }
  return [...parMois].map(([mois, liste]) => ({ mois, photos: liste }))
}

/** Remet un élément à sa place d'origine (annulation), sans jamais le dupliquer. */
export function insererA<T extends { id: string }>(liste: T[], element: T, index: number): T[] {
  if (liste.some((e) => e.id === element.id)) return liste
  const suite = [...liste]
  suite.splice(Math.max(0, Math.min(index, suite.length)), 0, element)
  return suite
}

/** Type réel d'une image d'après ses premiers octets : le type annoncé par le client ne prouve rien. */
export function signatureImage(octets: Uint8Array): TypeImage | null {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return 'image/jpeg'
  const riff = octets[0] === 0x52 && octets[1] === 0x49 && octets[2] === 0x46 && octets[3] === 0x46
  const webp = octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50
  if (octets.length >= 12 && riff && webp) return 'image/webp'
  return null
}

export function formaterOctets(octets: number, locale: string): string {
  const [ko, mo, go] = locale.startsWith('fr') ? ['Ko', 'Mo', 'Go'] : ['KB', 'MB', 'GB']
  const nombre = (n: number, decimales: number) => n.toLocaleString(locale, { maximumFractionDigits: decimales })
  if (octets >= 1024 ** 3) return `${nombre(octets / 1024 ** 3, 2)} ${go}`
  if (octets >= 1024 ** 2) return `${nombre(octets / 1024 ** 2, 1)} ${mo}`
  return `${nombre(Math.ceil(octets / 1024), 0)} ${ko}`
}

export function libelleDate(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
): string {
  const [annee, mois, jour] = iso.split('-').map(Number)
  return new Date(annee, mois - 1, jour).toLocaleDateString(locale, options)
}

export function libelleMois(mois: string, locale: string): string {
  const [annee, numero] = mois.split('-').map(Number)
  return new Date(annee, numero - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}
