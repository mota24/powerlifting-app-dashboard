'use client'

import { useEffect, useState } from 'react'
import { Footprints, Dumbbell, Droplets, Target, Flame, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useT, useLocale } from '@/app/ThemeContext'
import type { Traducteur } from '@/lib/i18n'
import { toLocalDateStr } from '@/lib/powerlifting'
import { PalmaresMois, RecapSemaine } from '@/components/power/classement-recap'
import {
  estDernierJourDuMois, estDimanche, gagnants, grouperParMois, grouperParSemaine, joursRestants,
  joursRestantsSemaine, libelleMois, MEDAILLES,
  type LigneClassement, type LigneRangee, type LigneSemaine, type MoisClasse,
} from '@/lib/classement'

const NB_MOIS = 12
const NB_SEMAINES = 2

export function Classement() {
  const t = useT()
  const locale = useLocale()
  const [mois, setMois] = useState<MoisClasse[] | null>(null)
  const [semaines, setSemaines] = useState<MoisClasse[]>([])
  const [erreur, setErreur] = useState(false)
  const [chargement, setChargement] = useState(true)
  // Incrémenté par le bouton d'actualisation : relancer l'effet plutôt que
  // d'appeler le chargement à la main garde une seule requête en vol et
  // permet d'ignorer une réponse arrivée après le démontage.
  const [demande, setDemande] = useState(0)

  useEffect(() => {
    let annule = false
    Promise.all([
      supabase.rpc('classement_mois', { p_nb: NB_MOIS }),
      supabase.rpc('classement_semaines', { p_nb: NB_SEMAINES }),
    ]).then(([reponseMois, reponseSemaines]) => {
      if (annule) return
      setChargement(false)
      setErreur(Boolean(reponseMois.error))
      if (!reponseMois.error) setMois(grouperParMois((reponseMois.data ?? []) as LigneClassement[]))
      // Le récapitulatif de la semaine est un bonus : s'il manque, le
      // classement du mois s'affiche quand même.
      setSemaines(reponseSemaines.error ? [] : grouperParSemaine((reponseSemaines.data ?? []) as LigneSemaine[]))
    })
    return () => { annule = true }
  }, [demande])

  const rafraichir = () => {
    setChargement(true)
    setDemande((n) => n + 1)
  }

  if (chargement && !mois) {
    return <div className="flex justify-center py-16 text-muted-foreground"><RefreshCw className="size-5 animate-spin" /></div>
  }

  if (erreur || !mois || mois.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('erreurClassement')}
      </div>
    )
  }

  const [courant, ...passes] = mois
  const [semaineCourante, semainePassee] = semaines
  const aujourdhui = new Date()
  // Le mois en cours peut ne pas avoir encore démarré : tant qu'il est à
  // venir, c'est la semaine qui fait le classement plutôt qu'un écran de zéros.
  const moisDemarre = courant.depuis <= toLocalDateStr(aujourdhui)
  const periode = moisDemarre || !semaineCourante ? courant : semaineCourante
  const surLeMois = periode === courant

  const restants = surLeMois ? joursRestants(courant.mois, aujourdhui) : joursRestantsSemaine(aujourdhui)
  const clotureCeSoir = surLeMois ? estDernierJourDuMois(aujourdhui) : estDimanche(aujourdhui)
  const premiers = gagnants(periode.lignes)
  const annonce = !clotureCeSoir || premiers.length === 0 ? ''
    : premiers.length === 1 ? t(surLeMois ? 'gagneLeMois' : 'gagneLaSemaine', { prenom: premiers[0].prenom })
    : t('egalite')

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {surLeMois ? libelleMois(courant.mois, locale) : t('semaineEnCours')}
            </p>
            <h2 className="text-2xl font-black text-foreground">
              {clotureCeSoir ? t(surLeMois ? 'resultatsMois' : 'resultatsSemaine') : t('classement')}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
              {clotureCeSoir ? t('dernierJour') : t('joursRestants', { n: restants })}
            </span>
            <button
              onClick={rafraichir}
              aria-label={t('chargement')}
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn('size-4', chargement && 'animate-spin')} />
            </button>
          </div>
        </div>

        {annonce && (
          <p className="rounded-2xl border border-primary bg-card px-4 py-3 text-sm font-black text-foreground">
            {MEDAILLES[0]} {annonce}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {periode.lignes.map((ligne) => (
            <CarteJoueur key={ligne.prenom} ligne={ligne} premiers={premiers} surLeMois={surLeMois} t={t} />
          ))}
        </div>
      </section>

      {moisDemarre && semaineCourante && (
        <RecapSemaine courante={semaineCourante} passee={semainePassee} dimanche={estDimanche(aujourdhui)} t={t} />
      )}

      <PalmaresMois passes={passes} joueurs={courant.lignes.map((l) => l.prenom)} t={t} locale={locale} />

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{t('reglesTitre')}</h3>
        <ul className="space-y-2.5">
          {([
            [Footprints, t('regle8000')],
            [Droplets, t('regleEau')],
            [Dumbbell, t('regleSeance')],
            [Target, t('regleObjectif')],
            [Flame, t('regleSerie')],
          ] as const).map(([Icone, texte]) => (
            <li key={texte} className="flex items-start gap-3 text-sm text-foreground">
              <Icone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{texte}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t('regleActif')}</p>
        <p className="text-xs text-muted-foreground">{t('regleMois')}</p>
      </section>
    </div>
  )
}

function CarteJoueur({ ligne, premiers, surLeMois, t }: { ligne: LigneRangee; premiers: LigneRangee[]; surLeMois: boolean; t: Traducteur }) {
  const enTete = ligne.rang === 1
  const criteres = [
    { icone: Footprints, libelle: t('critere8000'), valeur: String(ligne.jours_8000), points: ligne.pts_pas },
    // Critère absent de la base tant que la migration de l'eau n'est pas lancée.
    ...(ligne.jours_eau === undefined ? [] : [{ icone: Droplets, libelle: t('critereEau'), valeur: String(ligne.jours_eau), points: ligne.pts_eau ?? 0 }]),
    { icone: Dumbbell, libelle: t('critereSeances'), valeur: String(ligne.seances), points: ligne.pts_seances },
    { icone: Target, libelle: t(surLeMois ? 'critereObjectif' : 'critereObjectifSemaine'), valeur: `${ligne.objectif_fait}/${ligne.objectif_semaines}`, points: ligne.pts_objectif },
    { icone: Flame, libelle: t(surLeMois ? 'critereSerie' : 'critereSerieSemaine'), valeur: t('joursCourt', { n: ligne.serie }), points: ligne.pts_serie },
  ]

  return (
    <article className={cn('space-y-4 rounded-2xl border bg-card p-5', enTete ? 'border-primary' : 'border-border')}>
      <header className="flex items-center gap-3">
        {/* Pas de médaille tant que personne n'a marqué. */}
        <span className="text-3xl leading-none" aria-hidden>{ligne.points > 0 ? MEDAILLES[ligne.rang - 1] ?? '' : ''}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-black text-foreground">{ligne.prenom}</h3>
            {ligne.est_moi && (
              <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t('toi')}
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('niveauCourt')} {ligne.niveau} · {t('streakActuel')} {ligne.streak}
            {premiers.length > 1 && premiers.includes(ligne) ? ` · ${t('egalite')}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tabular-nums leading-none text-foreground">{ligne.points}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('pts')}</div>
        </div>
      </header>

      <ul className="space-y-2">
        {criteres.map(({ icone: Icone, libelle, valeur, points }) => (
          <li key={libelle} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
            <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{libelle}</span>
            <span className="text-xs font-bold tabular-nums text-muted-foreground">{valeur}</span>
            <span className={cn('w-10 text-right text-xs font-black tabular-nums', points > 0 ? 'text-foreground' : 'text-muted-foreground')}>
              +{points}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}
