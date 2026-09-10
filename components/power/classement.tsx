'use client'

import { useEffect, useState } from 'react'
import { Footprints, Dumbbell, Target, Flame, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useT, useLocale } from '@/app/ThemeContext'
import type { Traducteur } from '@/lib/i18n'

/** Une ligne renvoyée par la fonction SQL classement_semaines : uniquement des totaux. */
interface LigneClassement {
  semaine: string
  prenom: string
  est_moi: boolean
  points: number
  pts_pas: number
  pts_seances: number
  pts_objectif: number
  pts_serie: number
  jours_8000: number
  seances: number
  objectif_fait: number
  objectif_seances: number
  objectif_atteint: boolean
  serie: number
  niveau: number
  streak: number
}

type LigneRangee = LigneClassement & { rang: number }
type Semaine = { debut: string; lignes: LigneRangee[] }

const NB_SEMAINES = 8
const MEDAILLES = ['🥇', '🥈', '🥉']

function parseJour(iso: string): Date {
  const [annee, mois, jour] = iso.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}

/** Rang « olympique » : deux scores égaux partagent la même place. */
function ranger(lignes: LigneClassement[]): LigneRangee[] {
  return lignes
    .map((ligne) => ({ ...ligne, rang: 1 + lignes.filter((autre) => autre.points > ligne.points).length }))
    .sort((a, b) => a.rang - b.rang || a.prenom.localeCompare(b.prenom))
}

function grouperParSemaine(lignes: LigneClassement[]): Semaine[] {
  const parSemaine = new Map<string, LigneClassement[]>()
  for (const ligne of lignes) {
    const liste = parSemaine.get(ligne.semaine) ?? []
    liste.push(ligne)
    parSemaine.set(ligne.semaine, liste)
  }
  return [...parSemaine.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([debut, groupe]) => ({ debut, lignes: ranger(groupe) }))
}

export function Classement() {
  const t = useT()
  const locale = useLocale()
  const [semaines, setSemaines] = useState<Semaine[] | null>(null)
  const [erreur, setErreur] = useState(false)
  const [chargement, setChargement] = useState(true)
  // Incrémenté par le bouton d'actualisation : relancer l'effet plutôt que
  // d'appeler le chargement à la main garde une seule requête en vol et
  // permet d'ignorer une réponse arrivée après le démontage.
  const [demande, setDemande] = useState(0)

  useEffect(() => {
    let annule = false
    supabase.rpc('classement_semaines', { p_nb: NB_SEMAINES }).then(({ data, error }) => {
      if (annule) return
      setChargement(false)
      if (error) {
        setErreur(true)
        return
      }
      setErreur(false)
      setSemaines(grouperParSemaine((data ?? []) as LigneClassement[]))
    })
    return () => { annule = true }
  }, [demande])

  const rafraichir = () => {
    setChargement(true)
    setDemande((n) => n + 1)
  }

  if (chargement && !semaines) {
    return <div className="flex justify-center py-16 text-muted-foreground"><RefreshCw className="size-5 animate-spin" /></div>
  }

  if (erreur || !semaines || semaines.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('erreurClassement')}
      </div>
    )
  }

  const [courante, ...passees] = semaines
  const indexJour = (new Date().getDay() + 6) % 7
  const estDimanche = indexJour === 6
  const debut = parseJour(courante.debut)
  const fin = new Date(debut)
  fin.setDate(debut.getDate() + 6)
  const formaterJour = (date: Date) => date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const egalite = courante.lignes.length > 1 && courante.lignes.every((ligne) => ligne.rang === 1)

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('semaineDu', { debut: formaterJour(debut), fin: formaterJour(fin) })}
            </p>
            <h2 className="text-2xl font-black text-foreground">
              {estDimanche ? t('resultatsSemaine') : t('classement')}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
              {estDimanche ? t('dernierJour') : t('joursRestants', { n: 7 - indexJour })}
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
          {courante.lignes.map((ligne) => (
            <CarteJoueur key={ligne.prenom} ligne={ligne} egalite={egalite} t={t} />
          ))}
        </div>
      </section>

      <Historique passees={passees} joueurs={courante.lignes.map((l) => l.prenom)} t={t} formaterJour={formaterJour} />

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
      </section>
    </div>
  )
}

function CarteJoueur({ ligne, egalite, t }: { ligne: LigneRangee; egalite: boolean; t: Traducteur }) {
  const enTete = ligne.rang === 1
  const criteres = [
    { icone: Footprints, libelle: t('critere8000'), valeur: `${ligne.jours_8000}/7`, points: ligne.pts_pas },
    { icone: Dumbbell, libelle: t('critereSeances'), valeur: String(ligne.seances), points: ligne.pts_seances },
    { icone: Target, libelle: t('critereObjectif'), valeur: `${ligne.objectif_fait}/${ligne.objectif_seances}`, points: ligne.pts_objectif },
    { icone: Flame, libelle: t('critereSerie'), valeur: t('joursCourt', { n: ligne.serie }), points: ligne.pts_serie },
  ]

  return (
    <article className={cn('space-y-4 rounded-2xl border bg-card p-5', enTete ? 'border-primary' : 'border-border')}>
      <header className="flex items-center gap-3">
        <span className="text-3xl leading-none" aria-hidden>{MEDAILLES[ligne.rang - 1] ?? ''}</span>
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

function Historique({ passees, joueurs, t, formaterJour }: { passees: Semaine[]; joueurs: string[]; t: Traducteur; formaterJour: (d: Date) => string }) {
  // Une semaine sans aucun point n'a pas été jouée : ni victoire ni égalité.
  const jouees = passees.filter((semaine) => semaine.lignes.some((ligne) => ligne.points > 0))
  const victoires = new Map<string, number>(joueurs.map((prenom) => [prenom, 0]))
  let egalites = 0
  for (const semaine of jouees) {
    const gagnants = semaine.lignes.filter((ligne) => ligne.rang === 1)
    if (gagnants.length === 1) victoires.set(gagnants[0].prenom, (victoires.get(gagnants[0].prenom) ?? 0) + 1)
    else egalites++
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{t('historique')}</h3>
      {jouees.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aucunHistorique')}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-foreground">
            {t('victoires')} {[...victoires.entries()].map(([prenom, n]) => `${prenom} ${n}`).join(' · ')}
            {egalites > 0 ? ` · ${t('egalites')} ${egalites}` : ''}
          </p>
          <ul className="divide-y divide-border">
            {jouees.map((semaine) => {
              const debut = parseJour(semaine.debut)
              const fin = new Date(debut)
              fin.setDate(debut.getDate() + 6)
              const gagnants = semaine.lignes.filter((ligne) => ligne.rang === 1)
              return (
                <li key={semaine.debut} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formaterJour(debut)} – {formaterJour(fin)}</span>
                  <span className="min-w-0 truncate text-right font-bold text-foreground">
                    {gagnants.length === 1 ? `🥇 ${gagnants[0].prenom}` : t('egalite')}
                    <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                      {semaine.lignes.map((ligne) => ligne.points).join(' – ')}
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
