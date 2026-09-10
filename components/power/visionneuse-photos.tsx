'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Traducteur } from '@/lib/i18n'
import { libelleDate, type PhotoSeance } from '@/lib/photos'

/**
 * Photo en plein écran : glisser ou flèches pour passer à la voisine, Échap
 * pour fermer. La vignette floutée patiente le temps que la photo arrive.
 */
export function VisionneusePhotos({ photos, idOuvert, onChanger, onFermer, onSupprimer, onOuvrirSeance, onErreurLien, t, locale }: {
  photos: PhotoSeance[]
  idOuvert: string
  onChanger: (id: string) => void
  onFermer: () => void
  onSupprimer?: (photo: PhotoSeance) => void
  onOuvrirSeance?: (date: string) => void
  onErreurLien?: () => void
  t: Traducteur
  locale: string
}) {
  const index = photos.findIndex((p) => p.id === idOuvert)
  const photo = index === -1 ? null : photos[index]
  const [chargee, setChargee] = useState<string | null>(null)
  const departX = useRef<number | null>(null)

  // Photo disparue (supprimée, liste rechargée) : on referme.
  useEffect(() => {
    if (!photo) onFermer()
  }, [photo, onFermer])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
      else if (e.key === 'ArrowLeft' && photos[index - 1]) onChanger(photos[index - 1].id)
      else if (e.key === 'ArrowRight' && photos[index + 1]) onChanger(photos[index + 1].id)
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [index, photos, onChanger, onFermer])

  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = precedent }
  }, [])

  if (!photo) return null
  // Majuscule sur la première lettre seulement : la classe CSS capitalize
  // donnerait « Jueves, 10 De Septiembre De 2026 ».
  const libelle = libelleDate(photo.date, locale)
  const date = libelle.charAt(0).toUpperCase() + libelle.slice(1)

  return (
    // bg-black/95 et non bg-black : le thème rose ne garde du texte blanc que
    // sur les voiles de modale (voir globals.css), un bg-black y deviendrait clair.
    <div role="dialog" aria-modal="true" aria-label={date} className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="min-w-0 pl-1">
          <p className="truncate text-sm font-black">{date}</p>
          {photos.length > 1 && (
            <p className="text-[10px] font-bold tabular-nums tracking-widest text-white/60">{index + 1} / {photos.length}</p>
          )}
        </div>
        <button onClick={onFermer} aria-label={t('fermerPhoto')} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onPointerDown={(e) => { departX.current = e.clientX }}
        onPointerUp={(e) => {
          const depart = departX.current
          departX.current = null
          if (depart === null || Math.abs(e.clientX - depart) < 50) return
          const voisine = photos[e.clientX < depart ? index + 1 : index - 1]
          if (voisine) onChanger(voisine.id)
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.urlMini} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full object-contain blur-md" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={date}
          draggable={false}
          onLoad={() => setChargee(photo.id)}
          onError={onErreurLien}
          className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-200', chargee === photo.id ? 'opacity-100' : 'opacity-0')}
        />
        {chargee !== photo.id && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <RefreshCw className="size-6 animate-spin text-white/70" />
          </div>
        )}
        {index > 0 && (
          <button
            onClick={() => onChanger(photos[index - 1].id)}
            aria-label={t('photoPrecedente')}
            className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={() => onChanger(photos[index + 1].id)}
            aria-label={t('photoSuivante')}
            className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {(onOuvrirSeance || onSupprimer) && (
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {onOuvrirSeance ? (
            <button onClick={() => onOuvrirSeance(photo.date)} className="flex h-11 items-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10">
              <CalendarDays className="size-4" /> {t('voirSeance')}
            </button>
          ) : <span />}
          {onSupprimer && (
            <button onClick={() => onSupprimer(photo)} className="flex h-11 items-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10">
              <Trash2 className="size-4" /> {t('supprimer')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
