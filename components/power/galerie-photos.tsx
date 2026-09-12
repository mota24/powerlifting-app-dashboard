'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModale } from '@/lib/use-modale'
import { ArrowLeftRight, Columns2, Images, RefreshCw, X } from 'lucide-react'
import { useLocale, useT } from '@/app/ThemeContext'
import { PastilleExpiration, VisionneusePhotos } from '@/components/power/visionneuse-photos'
import type { Traducteur } from '@/lib/i18n'
import {
  DUREE_CONSERVATION_JOURS,
  PLAFOND_STOCKAGE_OCTETS,
  SEUIL_ALERTE_STOCKAGE,
  formaterOctets,
  grouperParMois,
  insererA,
  joursEntre,
  libelleDate,
  libelleMois,
  type EtatStockage,
  type PhotoSeance,
} from '@/lib/photos'
import { chargerGalerie, enregistrerPhoto, supprimerAvecAnnulation } from '@/lib/photos-client'
import { cn } from '@/lib/utils'

interface Chargement {
  version: number
  photos: PhotoSeance[] | 'indisponible'
  stockage: EtatStockage | null
}

/**
 * Toutes les photos du compte, rangées par mois, avec la place occupée et un
 * mode comparaison : deux photos côte à côte, ou superposées avec un curseur.
 */
export function GaleriePhotos({ onOuvrirSeance }: { onOuvrirSeance: (date: string) => void }) {
  const t = useT()
  const locale = useLocale()
  const [version, setVersion] = useState(0)
  const [charge, setCharge] = useState<Chargement | null>(null)
  const [idOuvert, setIdOuvert] = useState<string | null>(null)
  const [enComparaison, setEnComparaison] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [comparaisonOuverte, setComparaisonOuverte] = useState(false)
  const derniereRelance = useRef(0)

  useEffect(() => {
    let annule = false
    chargerGalerie().then((resultat) => {
      if (annule) return
      setCharge(resultat === 'indisponible' ? { version, photos: resultat, stockage: null } : { version, ...resultat })
    })
    return () => { annule = true }
  }, [version])

  const actuel = charge && charge.version === version ? charge.photos : null
  const photos = useMemo(() => (Array.isArray(actuel) ? actuel : []), [actuel])
  const groupes = useMemo(() => grouperParMois(photos), [photos])
  const octets = useMemo(() => photos.reduce((somme, p) => somme + p.octets, 0), [photos])
  const choisies = selection.map((id) => photos.find((p) => p.id === id)).filter((p): p is PhotoSeance => p !== undefined)

  const majPhotos = useCallback((maj: (liste: PhotoSeance[]) => PhotoSeance[]) => {
    setCharge((c) => (c && c.photos !== 'indisponible' ? { ...c, photos: maj(c.photos) } : c))
  }, [])
  const fermer = useCallback(() => setIdOuvert(null), [])
  const fermerComparaison = useCallback(() => setComparaisonOuverte(false), [])
  const relancer = useCallback(() => {
    if (Date.now() - derniereRelance.current < 60_000) return
    derniereRelance.current = Date.now()
    setVersion((v) => v + 1)
  }, [])

  const supprimer = (photo: PhotoSeance) => {
    const index = photos.findIndex((p) => p.id === photo.id)
    setIdOuvert(photos[index + 1]?.id ?? photos[index - 1]?.id ?? null)
    setSelection((s) => s.filter((id) => id !== photo.id))
    supprimerAvecAnnulation({
      photo,
      t,
      retirer: () => majPhotos((liste) => liste.filter((p) => p.id !== photo.id)),
      remettre: () => majPhotos((liste) => insererA(liste, photo, index)),
    })
  }

  // Deux photos au plus : une troisième remplace la plus ancienne sélection.
  const basculer = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id]))
  const basculerComparaison = () => {
    setEnComparaison((c) => !c)
    setSelection([])
  }

  // Jauge sur la place de tout le projet : le quota est commun aux deux comptes.
  // Sans mesure du serveur, elle se rabat sur les photos affichées.
  const utilises = charge?.stockage?.utilises ?? octets
  const plafond = charge?.stockage?.plafond ?? PLAFOND_STOCKAGE_OCTETS
  const part = utilises / plafond
  const remplissage = utilises > 0 ? Math.max(1, Math.min(100, part * 100)) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">
            {actuel === null ? t('photos') : photos.length === 1 ? t('unePhoto') : t('nPhotos', { n: photos.length })}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('photosConservation', { n: DUREE_CONSERVATION_JOURS })}
          </p>
          {/* Avec l'effacement automatique, l'espace ne se remplit qu'en cas d'abus : la jauge n'apparaît qu'alors. */}
          {part >= SEUIL_ALERTE_STOCKAGE && (
            <>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t('stockageUtilise', { taille: formaterOctets(utilises, locale), quota: formaterOctets(plafond, locale) })}
              </p>
              <div className="mt-2 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-secondary">
                <div className={cn('h-full rounded-full', part >= 0.9 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${remplissage}%` }} />
              </div>
              <p className="mt-2 text-xs font-bold text-destructive">{part >= 1 ? t('stockagePlein') : t('stockageBientotPlein')}</p>
            </>
          )}
        </div>
        {photos.length >= 2 && (
          <button
            onClick={basculerComparaison}
            aria-pressed={enComparaison}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest transition-colors',
              enComparaison ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-accent',
            )}
          >
            {enComparaison ? <X className="size-4" /> : <ArrowLeftRight className="size-4" />}
            {enComparaison ? t('annuler') : t('comparer')}
          </button>
        )}
      </div>

      {enComparaison && (
        <p className="text-center text-xs font-bold text-muted-foreground">
          {t('choisirDeuxPhotos')} · <span className="tabular-nums">{choisies.length}/2</span>
        </p>
      )}

      {actuel === null ? (
        <div className="flex justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground">
          <RefreshCw className="size-5 animate-spin" />
        </div>
      ) : actuel === 'indisponible' ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t('photosIndisponibles')}</p>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
          <Images className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('aucunePhoto')}</p>
        </div>
      ) : (
        groupes.map(({ mois, photos: duMois }) => (
          <section key={mois} className="space-y-2">
            <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{libelleMois(mois, locale)}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {duMois.map((photo) => {
                const rang = selection.indexOf(photo.id)
                return (
                  <button
                    key={photo.id}
                    onClick={() => (enComparaison ? basculer(photo.id) : setIdOuvert(photo.id))}
                    aria-pressed={enComparaison ? rang !== -1 : undefined}
                    aria-label={libelleDate(photo.date, locale)}
                    className={cn(
                      'group relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary',
                      rang !== -1 && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.urlMini} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <PastilleExpiration creeLe={photo.creeLe} t={t} />
                    <span className="absolute bottom-1 left-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-white">
                      {libelleDate(photo.date, locale, { day: 'numeric', month: 'short' })}
                    </span>
                    {rang !== -1 && (
                      <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                        {rang + 1}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))
      )}

      {enComparaison && choisies.length === 2 && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <button
            onClick={() => setComparaisonOuverte(true)}
            className="flex h-14 items-center gap-2 rounded-full bg-primary px-8 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-xl hover:opacity-90"
          >
            <ArrowLeftRight className="size-5" /> {t('comparer')}
          </button>
        </div>
      )}

      {idOuvert && (
        <VisionneusePhotos
          photos={photos}
          idOuvert={idOuvert}
          onChanger={setIdOuvert}
          onFermer={fermer}
          onSupprimer={supprimer}
          onEnregistrer={(photo) => void enregistrerPhoto(photo, t)}
          onOuvrirSeance={onOuvrirSeance}
          onErreurLien={relancer}
          t={t}
          locale={locale}
        />
      )}
      {comparaisonOuverte && choisies.length === 2 && (
        <Comparaison a={choisies[0]} b={choisies[1]} t={t} locale={locale} onFermer={fermerComparaison} onErreurLien={relancer} />
      )}
    </div>
  )
}

function Comparaison({ a, b, t, locale, onFermer, onErreurLien }: {
  a: PhotoSeance
  b: PhotoSeance
  t: Traducteur
  locale: string
  onFermer: () => void
  onErreurLien: () => void
}) {
  const [avant, apres] = a.date <= b.date ? [a, b] : [b, a]
  const ecart = joursEntre(avant.date, apres.date)
  const [affichage, setAffichage] = useState<'cote' | 'curseur'>('cote')
  const [position, setPosition] = useState(50)
  const zone = useRef<HTMLDivElement>(null)

  useModale(onFermer)

  const deplacer = (clientX: number) => {
    const cadre = zone.current?.getBoundingClientRect()
    if (!cadre || cadre.width === 0) return
    setPosition(Math.min(100, Math.max(0, ((clientX - cadre.left) / cadre.width) * 100)))
  }
  const titre = ecart === 0 ? t('memeJour') : ecart === 1 ? t('unJourEcart') : t('ecartJours', { n: ecart })
  const legende = (photo: PhotoSeance) => libelleDate(photo.date, locale, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div role="dialog" aria-modal="true" aria-label={t('comparer')} className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <p className="min-w-0 truncate pl-1 text-sm font-black">{titre}</p>
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex rounded-xl bg-white/10 p-1">
            {(['cote', 'curseur'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAffichage(mode)}
                aria-pressed={affichage === mode}
                aria-label={mode === 'cote' ? t('coteACote') : t('curseur')}
                className={cn('flex size-9 items-center justify-center rounded-lg transition-colors', affichage === mode ? 'bg-white text-black' : 'text-white/70 hover:text-white')}
              >
                {mode === 'cote' ? <Columns2 className="size-4" /> : <ArrowLeftRight className="size-4" />}
              </button>
            ))}
          </div>
          <button onClick={onFermer} aria-label={t('fermer')} className="flex size-11 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X className="size-5" />
          </button>
        </div>
      </div>

      {affichage === 'cote' ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {([['avant', avant], ['apres', apres]] as const).map(([cle, photo]) => (
            <figure key={cle} className="flex min-h-0 flex-col">
              <div className="relative min-h-0 flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.urlMini} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain blur-md" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={legende(photo)} onError={onErreurLien} className="absolute inset-0 h-full w-full object-contain" />
              </div>
              <figcaption className="py-2 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-white/60">{t(cle)}</span>
                <span className="block text-xs font-black">{legende(photo)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div
            ref={zone}
            className="relative min-h-0 flex-1 cursor-ew-resize touch-none select-none"
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId)
              } catch {
                // Pointeur déjà relâché (toucher très bref) : le curseur se place quand même.
              }
              deplacer(e.clientX)
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) deplacer(e.clientX)
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={apres.url} alt={legende(apres)} draggable={false} onError={onErreurLien} className="absolute inset-0 h-full w-full object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avant.url}
              alt={legende(avant)}
              draggable={false}
              onError={onErreurLien}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            />
            <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${position}%` }} />
            <div
              role="slider"
              tabIndex={0}
              aria-label={t('curseurComparaison')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(position)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - 5))
                else if (e.key === 'ArrowRight') setPosition((p) => Math.min(100, p + 5))
              }}
              className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ left: `${position}%` }}
            >
              <ArrowLeftRight className="size-5" />
            </div>
            <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest">{t('avant')}</span>
            <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest">{t('apres')}</span>
          </div>
          <div className="flex justify-between px-3 pt-2 text-xs font-black">
            <span>{legende(avant)}</span>
            <span>{legende(apres)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
