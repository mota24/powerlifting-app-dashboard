'use client'

import { useEffect, useState } from 'react'
import { Footprints, Dumbbell, Target, Flame, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useT, useLocale } from '@/app/ThemeContext'
import type { Traducteur } from '@/lib/i18n'
import { parseLocalDate } from '@/lib/powerlifting'
import { grouperParMois, joursRestants, libelleMois, palmares, type LigneClassement, type LigneRangee, type MoisClasse } from '@/lib/classement'

const NB_MOIS = 12
const MEDAILLES = ['🥇', '🥈', '🥉']

export function Classement() {
  const t = useT()
  const locale = useLocale()
  const [mois, setMois] = useState<MoisClasse[] | null>(null)
  const [erreur, setErreur] = useState(false)
  const [chargement, setChargement] = useState(true)
  // Incrémenté par le bouton d'actualisation : relancer l'effet plutôt que
  // d'appeler le chargement à la main garde une seule requête en vol et
  // permet d'ignorer une réponse arrivée après le démontage.
  const [demande, setDemande] = useState(0)

  useEffect(() => {
    let annule = false
    supabase.rpc('classement_mois', { p_nb: NB_MOIS }).then(({ data, error }) => {
      if (annule) return
      setChargement(false)
      if (error) {
        setErreur(true)
        return
      }
      setErreur(false)
      setMois(grouperParMois((data ?? []) as LigneClassement[]))
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
  const restants = joursRestants(courant.mois, new Date())
  const dernierJour = restants <= 1
  // Une égalité à zéro n'en est pas une : en début de mois, personne n'a encore joué.
  const egalite = courant.lignes.length > 1 && courant.lignes.every((ligne) => ligne.rang === 1) && courant.lignes.some((ligne) => ligne.points > 0)
  // Le classement a démarré en cours de mois : on le dit, pour que personne
  // ne cherche les points des premiers jours.
  const partiel = courant.depuis > courant.mois

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {libelleMois(courant.mois, locale)}
              {partiel && ` · ${t('compteDepuis', { date: parseLocalDate(courant.depuis).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}`}
            </p>
            <h2 className="text-2xl font-black text-foreground">
              {dernierJour ? t('resultatsMois') : t('classement')}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
              {dernierJour ? t('dernierJour') : t('joursRestants', { n: restants })}
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

        <div className="grid gap-3 sm:grid-cols-2">
          {courant.lignes.map((ligne) => (
            <CarteJoueur key={ligne.prenom} ligne={ligne} egalite={egalite} t={t} />
          ))}
        </div>
      </section>

      <Palmares passes={passes} joueurs={courant.lignes.map((l) => l.prenom)} t={t} locale={locale} />

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{t('reglesTitre')}</h3>
        <ul className="space-y-2.5">
          {([
            [Footprints, t('regle8000')],
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

function CarteJoueur({ ligne, egalite, t }: { ligne: LigneRangee; egalite: boolean; t: Traducteur }) {
  const enTete = ligne.rang === 1
  const criteres = [
    { icone: Footprints, libelle: t('critere8000'), valeur: String(ligne.jours_8000), points: ligne.pts_pas },
    { icone: Dumbbell, libelle: t('critereSeances'), valeur: String(ligne.seances), points: ligne.pts_seances },
    { icone: Target, libelle: t('critereObjectif'), valeur: `${ligne.objectif_fait}/${ligne.objectif_semaines}`, points: ligne.pts_objectif },
    { icone: Flame, libelle: t('critereSerie'), valeur: t('joursCourt', { n: ligne.serie }), points: ligne.pts_serie },
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
            {enTete && egalite ? ` · ${t('egalite')}` : ''}
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

function Palmares({ passes, joueurs, t, locale }: { passes: MoisClasse[]; joueurs: string[]; t: Traducteur; locale: string }) {
  const { victoires, egalites, joues } = palmares(passes, joueurs)

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{t('palmaresMois')}</h3>
      {joues.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aucunMoisTermine')}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-foreground">
            {t('victoires')} {[...victoires.entries()].map(([prenom, n]) => `${prenom} ${n}`).join(' · ')}
            {egalites > 0 ? ` · ${t('egalites')} ${egalites}` : ''}
          </p>
          <ul className="divide-y divide-border">
            {joues.map((mois) => {
              const gagnants = mois.lignes.filter((ligne) => ligne.rang === 1)
              return (
                <li key={mois.mois} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="shrink-0 text-muted-foreground">{libelleMois(mois.mois, locale)}</span>
                  <span className="min-w-0 truncate text-right font-bold text-foreground">
                    {gagnants.length === 1 ? `🥇 ${gagnants[0].prenom}` : t('egalite')}
                    <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                      {mois.lignes.map((ligne) => ligne.points).join(' – ')}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
