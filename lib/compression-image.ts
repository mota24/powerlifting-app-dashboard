import { COTE_MAX_PX, COTE_MINI_PX, OCTETS_MAX_PHOTO, QUALITES, QUALITE_MINI, dimensionsCible } from '@/lib/photos'

/**
 * Compression dans le navigateur, avant tout envoi : une photo de téléphone
 * (3 à 10 Mo) ressort vers 150 à 300 Ko, sa vignette vers 20 Ko.
 *
 * Le ré-encodage retire aussi les métadonnées EXIF, dont la position GPS que
 * certains téléphones inscrivent dans chaque photo.
 */

export interface ImageCompressee {
  photo: Blob
  mini: Blob
  largeur: number
  hauteur: number
}

interface ImageDecodee {
  source: CanvasImageSource
  largeur: number
  hauteur: number
  liberer: () => void
}

async function decoder(fichier: Blob): Promise<ImageDecodee> {
  // createImageBitmap redresse la photo selon son orientation EXIF (portrait pris au téléphone).
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
      return { source: bitmap, largeur: bitmap.width, hauteur: bitmap.height, liberer: () => bitmap.close() }
    } catch {
      // Format inconnu de createImageBitmap : on retente avec <img>.
    }
  }
  const url = URL.createObjectURL(fichier)
  const image = new Image()
  try {
    image.src = url
    await image.decode()
  } catch (erreur) {
    URL.revokeObjectURL(url)
    throw erreur
  }
  return { source: image, largeur: image.naturalWidth, hauteur: image.naturalHeight, liberer: () => URL.revokeObjectURL(url) }
}

function dessiner(source: CanvasImageSource, largeur: number, hauteur: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const contexte = canvas.getContext('2d')
  if (!contexte) throw new Error('Canvas indisponible')
  contexte.imageSmoothingEnabled = true
  contexte.imageSmoothingQuality = 'high'
  contexte.drawImage(source, 0, 0, largeur, hauteur)
  return canvas
}

function versBlob(canvas: HTMLCanvasElement, type: string, qualite: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, qualite))
}

async function encoder(canvas: HTMLCanvasElement, qualite: number): Promise<Blob> {
  // WebP d'abord. Safari ne sait pas l'encoder et rend du PNG, bien plus lourd : on passe alors en JPEG.
  const webp = await versBlob(canvas, 'image/webp', qualite)
  if (webp?.type === 'image/webp') return webp
  const jpeg = await versBlob(canvas, 'image/jpeg', qualite)
  if (!jpeg || jpeg.type !== 'image/jpeg') throw new Error('Encodage impossible')
  return jpeg
}

export async function compresserImage(fichier: Blob): Promise<ImageCompressee> {
  const image = await decoder(fichier)
  try {
    const cible = dimensionsCible(image.largeur, image.hauteur, COTE_MAX_PX)
    if (cible.largeur === 0) throw new Error('Image vide')
    const grande = dessiner(image.source, cible.largeur, cible.hauteur)
    let photo = await encoder(grande, QUALITES[0])
    for (const qualite of QUALITES.slice(1)) {
      if (photo.size <= OCTETS_MAX_PHOTO) break
      photo = await encoder(grande, qualite)
    }
    // La vignette part de la photo réduite : un seul grand saut d'échelle crénelerait l'image.
    const petite = dimensionsCible(cible.largeur, cible.hauteur, COTE_MINI_PX)
    const canvasMini = dessiner(grande, petite.largeur, petite.hauteur)
    const mini = await encoder(canvasMini, QUALITE_MINI)
    // iOS plafonne la mémoire totale des canvas : on les vide tout de suite.
    grande.width = 0
    grande.height = 0
    canvasMini.width = 0
    canvasMini.height = 0
    if (photo.size > OCTETS_MAX_PHOTO) throw new Error('Photo trop lourde')
    return { photo, mini, largeur: cible.largeur, hauteur: cible.hauteur }
  } finally {
    image.liberer()
  }
}
