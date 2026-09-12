'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Target, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/power/toaster'
import { proposerAnnulation } from '@/lib/annulation'
import { useLocale, useT, useTheme } from '@/app/ThemeContext'
import { parseLocalDate, toLocalDateStr } from '@/lib/powerlifting'
import type { Traducteur } from '@/lib/i18n'
import { GRAMMES_MAX, grammesValides, pourGrammes, recents, totauxDuJour, type Aliment, type EntreeJournal, type ObjectifsNutrition } from '@/lib/nutrition'
import { Total, arrondi, arrondi1 } from '@/components/power/nutrition-elements'
import { FenetreAjout } from '@/components/power/nutrition-ajout'
import { FenetreObjectifs } from '@/components/power/nutrition-objectifs'

function decalerJour(iso: string, delta: number): string {
  const date = parseLocalDate(iso)
  date.setDate(date.getDate() + delta)
  return toLocalDateStr(date)
}

export function Nutrition() {
  const t = useT()
  const locale = useLocale()
  const { langue } = useTheme()
  const [jour, setJour] = useState(() => toLocalDateStr(new Date()))
  const [entrees, setEntrees] = useState<EntreeJournal[]>([])
  const [historique, setHistorique] = useState<EntreeJournal[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [version, setVersion] = useState(0)
  const [objectifs, setObjectifs] = useState<ObjectifsNutrition | null>(null)
  const [versionObjectifs, setVersionObjectifs] = useState(0)
  const [objectifsOuverts, setObjectifsOuverts] = useState(false)

  const recharger = useCallback(() => setVersion((v) => v + 1), [])
  const fermerAjout = useCallback(() => setAjoutOuvert(false), [])

  useEffect(() => {
    let annule = false
    Promise.all([
      supabase.from('journal_alimentaire').select('*').eq('date', jour).order('cree_le', { ascending: true }),
      supabase.from('journal_alimentaire').select('*').order('cree_le', { ascending: false }).limit(60),
    ]).then(([duJour, recentes]) => {
      if (annule) return
      setChargement(false)
      if (duJour.error) {
        setErreur(true)
        return
      }
      setErreur(false)
      setEntrees((duJour.data ?? []) as EntreeJournal[])
      setHistorique((recentes.data ?? []) as EntreeJournal[])
    })
    return () => { annule = true }
  }, [jour, version])

  useEffect(() => {
    let annule = false
    supabase.from('objectifs_nutrition').select('kcal, proteines').maybeSingle().then(({ data, error }) => {
      // Table absente (migration pas encore lancée) : simplement pas d'objectifs.
      if (annule || error) return
      setObjectifs(data ? { kcal: data.kcal ?? null, proteines: data.proteines ?? null } : null)
    })
    return () => { annule = true }
  }, [versionObjectifs])

  const fermerObjectifs = useCallback(() => setObjectifsOuverts(false), [])
  const objectifsEnregistres = useCallback(() => {
    setObjectifsOuverts(false)
    setVersionObjectifs((v) => v + 1)
  }, [])

  const totaux = useMemo(() => totauxDuJour(entrees), [entrees])
  const alimentsRecents = useMemo(() => recents(historique), [historique])
  const estAujourdhui = jour === toLocalDateStr(new Date())

  const ajouter = async (aliment: Aliment, grammes: number): Promise<boolean> => {
    const { error } = await supabase.from('journal_alimentaire').insert([{
      date: jour,
      nom: aliment.nom,
      marque: aliment.marque,
      code_barres: aliment.code,
      grammes,
      kcal_100g: aliment.kcal100,
      proteines_100g: aliment.prot100,
    }])
    if (error) {
      toast(t('erreur'), 'error')
      return false
    }
    toast(t('alimentAjoute', { nom: aliment.nom }), 'success')
    setAjoutOuvert(false)
    recharger()
    return true
  }

  const modifierGrammes = async (entree: EntreeJournal, grammes: number) => {
    if (!grammesValides(grammes) || grammes === Number(entree.grammes)) return
    setEntrees((prev) => prev.map((e) => (e.id === entree.id ? { ...e, grammes } : e)))
    const { error } = await supabase.from('journal_alimentaire').update({ grammes }).eq('id', entree.id)
    if (error) {
      toast(t('erreur'), 'error')
      recharger()
    }
  }

  const supprimer = async (entree: EntreeJournal) => {
    const { error } = await supabase.from('journal_alimentaire').delete().eq('id', entree.id)
    if (error) {
      toast(t('erreur'), 'error')
      return
    }
    setEntrees((prev) => prev.filter((e) => e.id !== entree.id))
    proposerAnnulation({
      message: t('alimentSupprime'),
      libelleBouton: t('annuler'),
      annuler: async () => {
        // La copie vient d'un select('*') : même identifiant, même compte, même date.
        const { error: erreurRestauration } = await supabase.from('journal_alimentaire').insert([entree])
        if (erreurRestauration) {
          toast(t('restaurationImpossible'), 'error')
          return false
        }
        recharger()
        toast(t('restaure'), 'success')
        return true
      },
    })
  }

  const libelleJour = parseLocalDate(jour).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-2">
        <button
          onClick={() => setJour((j) => decalerJour(j, -1))}
          aria-label={t('jourPrecedent')}
          className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={() => setJour(toLocalDateStr(new Date()))}
          className="min-w-0 flex-1 truncate text-center text-sm font-black capitalize text-foreground"
        >
          {estAujourdhui ? t('aujourdhui') : libelleJour}
        </button>
        <button
          onClick={() => setJour((j) => decalerJour(j, 1))}
          aria-label={t('jourSuivant')}
          className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Total libelle={t('calories')} valeur={totaux.kcal} arrondir={arrondi} unite="kcal" objectif={objectifs?.kcal ?? null} depasserReussit={false} t={t} locale={locale} />
        <Total libelle={t('proteines')} valeur={totaux.prot} arrondir={arrondi1} unite="g" objectif={objectifs?.proteines ?? null} depasserReussit t={t} locale={locale} />
      </div>

      <button
        onClick={() => setObjectifsOuverts(true)}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Target className="size-4" /> {objectifs?.kcal || objectifs?.proteines ? t('modifierObjectifs') : t('definirObjectifs')}
      </button>

      <button
        onClick={() => setAjoutOuvert(true)}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground hover:opacity-90"
      >
        <Plus className="size-5" /> {t('ajouterAliment')}
      </button>

      <section className="rounded-2xl border border-border bg-card">
        {chargement ? (
          <div className="flex justify-center p-8 text-muted-foreground"><RefreshCw className="size-5 animate-spin" /></div>
        ) : erreur ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t('journalIndisponible')}</p>
        ) : entrees.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t('journalVide')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {entrees.map((e) => (
              <LigneEntree
                key={`${e.id}-${e.grammes}`}
                entree={e}
                t={t}
                locale={locale}
                onGrammes={(g) => modifierGrammes(e, g)}
                onSupprimer={() => supprimer(e)}
              />
            ))}
          </ul>
        )}
      </section>

      {ajoutOuvert && (
        <FenetreAjout langue={langue} t={t} locale={locale} recents={alimentsRecents} onFermer={fermerAjout} onAjouter={ajouter} />
      )}
      {objectifsOuverts && (
        <FenetreObjectifs actuels={objectifs} t={t} locale={locale} onFermer={fermerObjectifs} onEnregistre={objectifsEnregistres} />
      )}
    </div>
  )
}

function LigneEntree({ entree, t, locale, onGrammes, onSupprimer }: {
  entree: EntreeJournal
  t: Traducteur
  locale: string
  onGrammes: (grammes: number) => void
  onSupprimer: () => void
}) {
  const [grammes, setGrammes] = useState(String(entree.grammes))
  const kcal = pourGrammes(Number(entree.kcal_100g), Number(entree.grammes))
  const prot = pourGrammes(Number(entree.proteines_100g), Number(entree.grammes))

  const valider = () => {
    const valeur = Number.parseFloat(grammes.replace(',', '.'))
    if (grammesValides(valeur)) onGrammes(valeur)
    else setGrammes(String(entree.grammes))
  }

  return (
    <li className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{entree.nom}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[entree.marque, `${arrondi(kcal).toLocaleString(locale)} kcal`, `${arrondi1(prot).toLocaleString(locale)} g ${t('protAbrege')}`].filter(Boolean).join(' · ')}
        </p>
      </div>
      <label className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-2">
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={GRAMMES_MAX}
          value={grammes}
          onChange={(ev) => setGrammes(ev.target.value)}
          onBlur={valider}
          onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
          aria-label={t('grammes')}
          className="h-10 w-16 bg-transparent text-right text-base font-black tabular-nums text-foreground outline-none"
        />
        <span className="text-xs font-bold text-muted-foreground">g</span>
      </label>
      <button
        onClick={onSupprimer}
        aria-label={t('supprimer')}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}
