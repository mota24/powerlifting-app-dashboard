'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, PenLine, Plus, RefreshCw, ScanLine, Search, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/components/power/toaster'
import { proposerAnnulation } from '@/lib/annulation'
import { useLocale, useT, useTheme } from '@/app/ThemeContext'
import { toLocalDateStr } from '@/lib/powerlifting'
import type { Langue, Traducteur } from '@/lib/i18n'
import { GRAMMES_MAX, grammesValides, pourGrammes, recents, totauxDuJour, type Aliment, type EntreeJournal } from '@/lib/nutrition'

type Onglet = 'scanner' | 'recherche' | 'recents' | 'manuel'

const arrondi = (n: number) => Math.round(n)
const arrondi1 = (n: number) => Math.round(n * 10) / 10

function decalerJour(iso: string, delta: number): string {
  const [annee, mois, jour] = iso.split('-').map(Number)
  return toLocalDateStr(new Date(annee, mois - 1, jour + delta))
}

async function appelerApi(params: URLSearchParams): Promise<Aliment[] | 'erreur'> {
  try {
    const rep = await fetch(`/api/aliments?${params}`)
    if (!rep.ok) return 'erreur'
    const corps = (await rep.json()) as { aliments?: Aliment[] }
    return corps.aliments ?? []
  } catch {
    return 'erreur'
  }
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

  const [annee, mois, numero] = jour.split('-').map(Number)
  const libelleJour = new Date(annee, mois - 1, numero).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

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
        <Total libelle={t('calories')} valeur={arrondi(totaux.kcal).toLocaleString(locale)} unite="kcal" />
        <Total libelle={t('proteines')} valeur={arrondi1(totaux.prot).toLocaleString(locale)} unite="g" />
      </div>

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
    </div>
  )
}

function Total({ libelle, valeur, unite }: { libelle: string; valeur: string; unite: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{libelle}</p>
      <p className="mt-1 text-3xl font-black tabular-nums text-foreground">
        {valeur} <span className="text-sm font-bold text-muted-foreground">{unite}</span>
      </p>
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

function FenetreAjout({ langue, t, locale, recents: alimentsRecents, onFermer, onAjouter }: {
  langue: Langue
  t: Traducteur
  locale: string
  recents: Aliment[]
  onFermer: () => void
  onAjouter: (aliment: Aliment, grammes: number) => Promise<boolean>
}) {
  const [onglet, setOnglet] = useState<Onglet>('scanner')
  const [choisi, setChoisi] = useState<Aliment | null>(null)
  const [zoneVisible, setZoneVisible] = useState(lireZoneVisible)

  useEffect(() => {
    const vue = window.visualViewport
    if (!vue) return
    const suivre = () => setZoneVisible({ haut: vue.offsetTop, hauteur: vue.height })
    vue.addEventListener('resize', suivre)
    vue.addEventListener('scroll', suivre)
    return () => {
      vue.removeEventListener('resize', suivre)
      vue.removeEventListener('scroll', suivre)
    }
  }, [])

  // Page figée derrière la fenêtre : sinon iOS la fait défiler quand le clavier s'ouvre.
  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = precedent }
  }, [])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])

  const onglets: { cle: Onglet; icone: typeof ScanLine; libelle: string }[] = [
    { cle: 'scanner', icone: ScanLine, libelle: t('ongletScanner') },
    { cle: 'recherche', icone: Search, libelle: t('ongletRecherche') },
    { cle: 'recents', icone: Clock, libelle: t('ongletRecents') },
    { cle: 'manuel', icone: PenLine, libelle: t('ongletManuel') },
  ]

  // Hauteur et position calées sur la zone réellement visible : quand le
  // clavier s'ouvre sur mobile, la fenêtre reste au-dessus de lui au lieu de
  // passer dessous et de faire défiler la page.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('ajouterAliment')}
      style={zoneVisible ? { top: zoneVisible.haut, height: zoneVisible.hauteur } : undefined}
      className={cn('fixed inset-x-0 z-[100] flex items-end justify-center overflow-hidden bg-black/90 pt-6 sm:items-center sm:p-4', !zoneVisible && 'inset-y-0')}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:max-h-[92dvh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{choisi ? t('quantite') : t('ajouterAliment')}</h2>
          <button onClick={onFermer} aria-label={t('fermer')} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="size-5" />
          </button>
        </header>

        {choisi ? (
          <ChoixQuantite aliment={choisi} t={t} locale={locale} onRetour={() => setChoisi(null)} onAjouter={onAjouter} />
        ) : (
          <>
            <nav className="grid grid-cols-4 gap-1 border-b border-border p-2">
              {onglets.map(({ cle, icone: Icone, libelle }) => (
                <button
                  key={cle}
                  onClick={() => setOnglet(cle)}
                  aria-pressed={onglet === cle}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold uppercase tracking-wider transition-colors',
                    onglet === cle ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icone className="size-4" />
                  <span className="max-w-full truncate px-1">{libelle}</span>
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {onglet === 'scanner' && <Scanner langue={langue} t={t} onTrouve={setChoisi} />}
              {onglet === 'recherche' && <Recherche langue={langue} t={t} locale={locale} onChoisir={setChoisi} />}
              {onglet === 'recents' && <ListeAliments aliments={alimentsRecents} vide={t('aucunRecent')} t={t} locale={locale} onChoisir={setChoisi} />}
              {onglet === 'manuel' && <SaisieManuelle t={t} onValider={setChoisi} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function lireZoneVisible(): { haut: number; hauteur: number } | null {
  if (typeof window === 'undefined' || !window.visualViewport) return null
  return { haut: window.visualViewport.offsetTop, hauteur: window.visualViewport.height }
}

type EtatScanner = 'demarrage' | 'lecture' | 'recherche' | 'refus' | 'camera' | 'introuvable' | 'erreur'

function Scanner({ langue, t, onTrouve }: { langue: Langue; t: Traducteur; onTrouve: (aliment: Aliment) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [etat, setEtat] = useState<EtatScanner>('demarrage')
  const [essai, setEssai] = useState(0)
  const [dernierCode, setDernierCode] = useState('')
  const [codeManuel, setCodeManuel] = useState('')

  const chercherCode = useCallback(async (code: string) => {
    setEtat('recherche')
    setDernierCode(code)
    const resultat = await appelerApi(new URLSearchParams({ code, lang: langue }))
    if (resultat === 'erreur') {
      setEtat('erreur')
      return
    }
    if (resultat.length === 0) {
      setEtat('introuvable')
      return
    }
    onTrouve(resultat[0])
  }, [langue, onTrouve])

  useEffect(() => {
    let annule = false
    let controlesActifs: { stop: () => void } | null = null
    let dejaLu = false

    const demarrer = async () => {
      try {
        // Chargées à l'ouverture du scanner seulement : l'accueil reste léger.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (annule || !videoRef.current) return
        // Codes-barres alimentaires uniquement : lecture plus rapide et moins de faux positifs.
        const indices = new Map([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
        ])
        const lecteur = new BrowserMultiFormatReader(indices)
        const controles = await lecteur.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (resultat, _erreur, ctrl) => {
            if (!resultat || dejaLu) return
            dejaLu = true
            ctrl.stop()
            void chercherCode(resultat.getText())
          }
        )
        controlesActifs = controles
        if (annule) {
          controles.stop()
          return
        }
        setEtat('lecture')
      } catch (e) {
        if (annule) return
        const nom = e instanceof Error ? e.name : ''
        setEtat(nom === 'NotAllowedError' || nom === 'SecurityError' ? 'refus' : 'camera')
      }
    }

    void demarrer()
    return () => {
      annule = true
      controlesActifs?.stop()
    }
  }, [chercherCode, essai])

  const messages: Record<EtatScanner, string> = {
    demarrage: t('scannerDemarrage'),
    lecture: t('scannerViser'),
    recherche: t('scannerRecherche'),
    refus: t('cameraRefusee'),
    camera: t('cameraIndisponible'),
    introuvable: t('produitIntrouvable', { code: dernierCode }),
    erreur: t('serviceIndisponible'),
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-secondary">
        <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
        {etat === 'lecture' && (
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-primary" />
        )}
      </div>

      <p role="status" className="text-center text-sm font-bold text-foreground">{messages[etat]}</p>

      {(etat === 'introuvable' || etat === 'erreur') && (
        <button
          onClick={() => { setEtat('demarrage'); setEssai((n) => n + 1) }}
          className="h-11 w-full rounded-xl border border-border text-xs font-black uppercase tracking-widest text-foreground hover:bg-secondary"
        >
          {t('reessayer')}
        </button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const code = codeManuel.replace(/\D/g, '')
          if (code.length >= 6 && code.length <= 14) void chercherCode(code)
        }}
        className="flex gap-2"
      >
        <input
          value={codeManuel}
          onChange={(e) => setCodeManuel(e.target.value)}
          inputMode="numeric"
          placeholder={t('codeBarres')}
          aria-label={t('codeBarres')}
          className="h-12 min-w-0 flex-1 rounded-xl bg-secondary px-3 text-base font-bold tabular-nums text-foreground outline-none"
        />
        <button type="submit" className="h-12 shrink-0 rounded-xl border border-border px-4 text-xs font-black uppercase tracking-widest text-foreground hover:bg-secondary">
          {t('chercher')}
        </button>
      </form>
    </div>
  )
}

function Recherche({ langue, t, locale, onChoisir }: { langue: Langue; t: Traducteur; locale: string; onChoisir: (aliment: Aliment) => void }) {
  const [texte, setTexte] = useState('')
  const [resultats, setResultats] = useState<Aliment[] | null>(null)
  const [etat, setEtat] = useState<'repos' | 'recherche' | 'erreur'>('repos')

  useEffect(() => {
    const requete = texte.trim()
    if (requete.length < 2) return
    let annule = false
    // Délai de frappe : une requête par pause, pas une par lettre.
    const id = setTimeout(async () => {
      setEtat('recherche')
      const r = await appelerApi(new URLSearchParams({ q: requete, lang: langue }))
      if (annule) return
      if (r === 'erreur') {
        setEtat('erreur')
        return
      }
      setResultats(r)
      setEtat('repos')
    }, 450)
    return () => {
      annule = true
      clearTimeout(id)
    }
  }, [texte, langue])

  const assezLong = texte.trim().length >= 2

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 rounded-xl bg-secondary px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={t('rechercheAliment')}
          aria-label={t('ongletRecherche')}
          className="h-12 min-w-0 flex-1 bg-transparent text-base font-bold text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {assezLong && etat === 'recherche' && <p className="text-center text-sm text-muted-foreground">{t('rechercheEnCours')}</p>}
      {assezLong && etat === 'erreur' && <p className="text-center text-sm text-muted-foreground">{t('serviceIndisponible')}</p>}
      {assezLong && etat === 'repos' && resultats && (
        <ListeAliments aliments={resultats} vide={t('aucunResultat')} t={t} locale={locale} onChoisir={onChoisir} />
      )}
    </div>
  )
}

function ListeAliments({ aliments, vide, t, locale, onChoisir }: {
  aliments: Aliment[]
  vide: string
  t: Traducteur
  locale: string
  onChoisir: (aliment: Aliment) => void
}) {
  if (aliments.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{vide}</p>
  return (
    <div className="space-y-2">
      <p className="text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('valeursPour100g')}</p>
      <ul className="space-y-2">
        {aliments.map((a, i) => (
          <li key={`${a.code ?? a.nom}-${i}`}>
            <button onClick={() => onChoisir(a)} className="flex w-full items-center gap-3 rounded-xl bg-secondary p-3 text-left hover:bg-accent">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{a.nom}</p>
                {a.marque && <p className="truncate text-xs text-muted-foreground">{a.marque}</p>}
              </div>
              <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                <p><span className="font-black text-foreground">{arrondi(a.kcal100).toLocaleString(locale)}</span> kcal</p>
                <p>{a.prot100.toLocaleString(locale)} g {t('protAbrege')}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SaisieManuelle({ t, onValider }: { t: Traducteur; onValider: (aliment: Aliment) => void }) {
  const [nom, setNom] = useState('')
  const [kcal, setKcal] = useState('')
  const [prot, setProt] = useState('')
  const k = Number.parseFloat(kcal.replace(',', '.'))
  const p = Number.parseFloat(prot.replace(',', '.'))
  const valide = nom.trim().length > 0 && Number.isFinite(k) && k >= 0 && k <= 1000 && Number.isFinite(p) && p >= 0 && p <= 100
  // 16 px minimum : en dessous, Safari iOS zoome toute la page quand le champ prend le focus.
  const classeChamp = 'h-12 w-full rounded-xl bg-secondary px-3 text-base font-bold text-foreground outline-none'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valide) onValider({ code: null, nom: nom.trim().slice(0, 200), marque: null, kcal100: k, prot100: p, portionG: null })
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('nomAliment')}</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={200} className={classeChamp} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('kcalPour100g')}</span>
          <input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" className={cn(classeChamp, 'tabular-nums')} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('proteinesPour100g')}</span>
          <input value={prot} onChange={(e) => setProt(e.target.value)} inputMode="decimal" className={cn(classeChamp, 'tabular-nums')} />
        </label>
      </div>
      <button type="submit" disabled={!valide} className="h-12 w-full rounded-xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40">
        {t('continuer')}
      </button>
    </form>
  )
}

function ChoixQuantite({ aliment, t, locale, onRetour, onAjouter }: {
  aliment: Aliment
  t: Traducteur
  locale: string
  onRetour: () => void
  onAjouter: (aliment: Aliment, grammes: number) => Promise<boolean>
}) {
  const [grammes, setGrammes] = useState(String(aliment.grammesParDefaut ?? aliment.portionG ?? 100))
  const [envoi, setEnvoi] = useState(false)
  const g = Number.parseFloat(grammes.replace(',', '.'))
  const valide = grammesValides(g)
  const kcal = valide ? pourGrammes(aliment.kcal100, g) : 0
  const prot = valide ? pourGrammes(aliment.prot100, g) : 0
  const raccourcis = [...new Set([aliment.portionG, 100, 150, 200, 250].filter((x): x is number => typeof x === 'number' && x > 0))].slice(0, 4)

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <div>
        <p className="text-base font-black text-foreground">{aliment.nom}</p>
        <p className="text-xs text-muted-foreground">
          {[aliment.marque, `${arrondi(aliment.kcal100).toLocaleString(locale)} kcal · ${aliment.prot100.toLocaleString(locale)} g ${t('protAbrege')} / 100 g`].filter(Boolean).join(' · ')}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('grammes')}</span>
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min={1}
            max={GRAMMES_MAX}
            value={grammes}
            onChange={(e) => setGrammes(e.target.value)}
            className="h-14 min-w-0 flex-1 bg-transparent text-2xl font-black tabular-nums text-foreground outline-none"
          />
          <span className="text-sm font-bold text-muted-foreground">g</span>
        </div>
      </label>

      <div className="flex flex-wrap gap-2">
        {raccourcis.map((valeur) => (
          <button
            key={valeur}
            onClick={() => setGrammes(String(valeur))}
            className={cn(
              'h-10 rounded-xl px-3 text-xs font-bold tabular-nums',
              g === valeur ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-accent'
            )}
          >
            {valeur === aliment.portionG ? t('unePortion', { g: valeur }) : `${valeur} g`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Total libelle={t('calories')} valeur={arrondi(kcal).toLocaleString(locale)} unite="kcal" />
        <Total libelle={t('proteines')} valeur={arrondi1(prot).toLocaleString(locale)} unite="g" />
      </div>

      <div className="flex gap-2">
        <button onClick={onRetour} className="h-12 flex-1 rounded-xl border border-border text-xs font-black uppercase tracking-widest text-foreground hover:bg-secondary">
          {t('retour')}
        </button>
        <button
          disabled={!valide || envoi}
          onClick={async () => {
            setEnvoi(true)
            const ok = await onAjouter(aliment, g)
            if (!ok) setEnvoi(false)
          }}
          className="flex h-12 flex-[2] items-center justify-center rounded-xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          {envoi ? <RefreshCw className="size-4 animate-spin" /> : t('ajouterAuJournal')}
        </button>
      </div>
    </div>
  )
}
