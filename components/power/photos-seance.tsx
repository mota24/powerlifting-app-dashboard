'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, RefreshCw } from 'lucide-react'
import { useLocale, useT } from '@/app/ThemeContext'
import { toast } from '@/components/power/toaster'
import { PastilleExpiration, VisionneusePhotos } from '@/components/power/visionneuse-photos'
import { DUREE_CONSERVATION_JOURS, PHOTOS_MAX_PAR_JOUR, insererA, type PhotoSeance } from '@/lib/photos'
import { MESSAGE_ERREUR, chargerPhotos, enregistrerPhoto, envoyerPhoto, supprimerAvecAnnulation } from '@/lib/photos-client'

interface Chargement {
  date: string
  version: number
  photos: PhotoSeance[] | 'indisponible'
}

interface Envoi {
  cle: string
  date: string
  apercu: string
}

/**
 * Photos d'une séance (6 au plus). Compressées dans le téléphone avant
 * l'envoi, privées au compte ; la suppression s'annule comme le reste.
 */
export function PhotosSeance({ date }: { date: string }) {
  const t = useT()
  const locale = useLocale()
  const [version, setVersion] = useState(0)
  const [charge, setCharge] = useState<Chargement | null>(null)
  const [envois, setEnvois] = useState<Envoi[]>([])
  const [idOuvert, setIdOuvert] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)
  const compteurEnvois = useRef(0)
  const derniereRelance = useRef(0)

  useEffect(() => {
    let annule = false
    chargerPhotos(date).then((photos) => {
      if (!annule) setCharge({ date, version, photos })
    })
    return () => { annule = true }
  }, [date, version])

  const actuel = charge && charge.date === date && charge.version === version ? charge.photos : null
  const photos = Array.isArray(actuel) ? actuel : []
  const envoisDuJour = envois.filter((e) => e.date === date)
  const total = photos.length + envoisDuJour.length
  const places = PHOTOS_MAX_PAR_JOUR - total

  const majPhotos = useCallback((dateVisee: string, maj: (liste: PhotoSeance[]) => PhotoSeance[]) => {
    setCharge((c) => (c && c.date === dateVisee && c.photos !== 'indisponible' ? { ...c, photos: maj(c.photos) } : c))
  }, [])

  const fermer = useCallback(() => setIdOuvert(null), [])

  // Lien signé expiré (page ouverte depuis plus d'une heure) : on recharge, au plus une fois par minute.
  const relancer = useCallback(() => {
    if (Date.now() - derniereRelance.current < 60_000) return
    derniereRelance.current = Date.now()
    setVersion((v) => v + 1)
  }, [])

  const ajouter = async (fichiers: File[]) => {
    const dateEnvoi = date
    const choisis = fichiers.slice(0, Math.max(0, places))
    if (choisis.length < fichiers.length) toast(t('photoLimiteJour', { max: PHOTOS_MAX_PAR_JOUR }), 'info')
    if (choisis.length === 0) return
    const lot = choisis.map((fichier) => ({
      fichier,
      envoi: { cle: `envoi-${++compteurEnvois.current}`, date: dateEnvoi, apercu: URL.createObjectURL(fichier) },
    }))
    setEnvois((prev) => [...prev, ...lot.map((l) => l.envoi)])
    let reussies = 0
    // Une photo à la fois : la compression demande beaucoup de mémoire à un téléphone.
    for (const { fichier, envoi } of lot) {
      const resultat = await envoyerPhoto(dateEnvoi, fichier)
      setEnvois((prev) => prev.filter((e) => e.cle !== envoi.cle))
      URL.revokeObjectURL(envoi.apercu)
      if (resultat === 'recharger') {
        reussies++
        setVersion((v) => v + 1)
      } else if (typeof resultat === 'string') {
        toast(t(MESSAGE_ERREUR[resultat], { max: PHOTOS_MAX_PAR_JOUR }), 'error')
      } else {
        reussies++
        majPhotos(dateEnvoi, (liste) => [...liste, resultat])
      }
    }
    if (reussies > 0) toast(reussies === 1 ? t('photoAjoutee') : t('photosAjoutees', { n: reussies }), 'success')
  }

  const supprimer = (photo: PhotoSeance) => {
    const index = photos.findIndex((p) => p.id === photo.id)
    setIdOuvert(photos[index + 1]?.id ?? photos[index - 1]?.id ?? null)
    supprimerAvecAnnulation({
      photo,
      t,
      retirer: () => majPhotos(photo.date, (liste) => liste.filter((p) => p.id !== photo.id)),
      remettre: () => majPhotos(photo.date, (liste) => insererA(liste, photo, index)),
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Camera className="size-4 text-foreground" /> {t('photosSeance')}
        </h3>
        {total > 0 && (
          <span className="text-[10px] font-bold tabular-nums tracking-widest text-muted-foreground">{total}/{PHOTOS_MAX_PAR_JOUR}</span>
        )}
      </div>

      {actuel === null ? (
        <div className="flex justify-center py-6 text-muted-foreground"><RefreshCw className="size-5 animate-spin" /></div>
      ) : actuel === 'indisponible' ? (
        <p className="text-sm text-muted-foreground">{t('photosIndisponibles')}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setIdOuvert(photo.id)}
                aria-label={t('voirPhoto')}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.urlMini} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                <PastilleExpiration creeLe={photo.creeLe} t={t} />
              </button>
            ))}
            {envoisDuJour.map((envoi) => (
              <div key={envoi.cle} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={envoi.apercu} alt="" className="h-full w-full object-cover opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center text-foreground">
                  <RefreshCw className="size-5 animate-spin" />
                </div>
              </div>
            ))}
            {places > 0 && (
              <button
                onClick={() => champ.current?.click()}
                aria-label={t('ajouterPhoto')}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
              >
                <ImagePlus className="size-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('ajouter')}</span>
              </button>
            )}
          </div>
          {total === 0 && <p className="mt-3 text-xs text-muted-foreground">{t('photosAstuce', { n: DUREE_CONSERVATION_JOURS })}</p>}
        </>
      )}

      <input
        ref={champ}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          const fichiers = [...(e.target.files ?? [])]
          e.target.value = ''
          void ajouter(fichiers)
        }}
      />

      {idOuvert && (
        <VisionneusePhotos
          photos={photos}
          idOuvert={idOuvert}
          onChanger={setIdOuvert}
          onFermer={fermer}
          onSupprimer={supprimer}
          onEnregistrer={(photo) => void enregistrerPhoto(photo, t)}
          onErreurLien={relancer}
          t={t}
          locale={locale}
        />
      )}
    </section>
  )
}
