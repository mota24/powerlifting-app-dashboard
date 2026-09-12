'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, PenLine, Plus, RefreshCw, ScanLine, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/components/power/toaster'
import type { Langue, Traducteur } from '@/lib/i18n'
import { GRAMMES_MAX, depuisAlimentPerso, grammesValides, pourGrammes, variantesCode, type Aliment, type AlimentPerso, type ProduitPartiel } from '@/lib/nutrition'
import { FeuilleMobile } from '@/components/power/feuille-mobile'
import { Total, arrondi, arrondi1 } from '@/components/power/nutrition-elements'

type Onglet = 'scanner' | 'recherche' | 'recents' | 'manuel'

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

const COLONNES_PERSO = 'code_barres, nom, marque, kcal_100g, proteines_100g, portion_g'

/**
 * Code-barres : d'abord les produits déjà saisis par le compte (réponse immédiate),
 * puis Open Food Facts. Une fiche incomplète renvoie de quoi pré-remplir la saisie.
 */
async function chercherCodeBarres(code: string, langue: Langue): Promise<{ aliment: Aliment } | { partiel: ProduitPartiel | null } | 'erreur'> {
  const perso = await supabase.from('aliments_perso').select(COLONNES_PERSO).in('code_barres', variantesCode(code)).limit(1)
  // Table absente (migration pas encore lancée) : on passe simplement à Open Food Facts.
  const connu = !perso.error ? (perso.data as AlimentPerso[] | null)?.[0] : undefined
  if (connu) return { aliment: depuisAlimentPerso(connu) }
  try {
    const rep = await fetch(`/api/aliments?${new URLSearchParams({ code, lang: langue })}`)
    if (!rep.ok) return 'erreur'
    const corps = (await rep.json()) as { aliments?: Aliment[]; partiel?: ProduitPartiel | null }
    const aliment = corps.aliments?.[0]
    return aliment ? { aliment } : { partiel: corps.partiel ?? null }
  } catch {
    return 'erreur'
  }
}

/** Produits saisis par le compte dont le nom contient le texte cherché. */
async function chercherAlimentsPerso(texte: string): Promise<Aliment[]> {
  const motif = texte.replace(/[%_\\]/g, '')
  const { data, error } = await supabase.from('aliments_perso').select(COLONNES_PERSO).ilike('nom', `%${motif}%`).order('modifie_le', { ascending: false }).limit(5)
  return error || !data ? [] : (data as AlimentPerso[]).map(depuisAlimentPerso)
}

export function FenetreAjout({ langue, t, locale, recents: alimentsRecents, onFermer, onAjouter }: {
  langue: Langue
  t: Traducteur
  locale: string
  recents: Aliment[]
  onFermer: () => void
  onAjouter: (aliment: Aliment, grammes: number) => Promise<boolean>
}) {
  const [onglet, setOnglet] = useState<Onglet>('scanner')
  const [choisi, setChoisi] = useState<Aliment | null>(null)
  const [prerempli, setPrerempli] = useState<ProduitPartiel | null>(null)

  const onglets: { cle: Onglet; icone: typeof ScanLine; libelle: string }[] = [
    { cle: 'scanner', icone: ScanLine, libelle: t('ongletScanner') },
    { cle: 'recherche', icone: Search, libelle: t('ongletRecherche') },
    { cle: 'recents', icone: Clock, libelle: t('ongletRecents') },
    { cle: 'manuel', icone: PenLine, libelle: t('ongletManuel') },
  ]

  return (
    <FeuilleMobile titre={choisi ? t('quantite') : t('ajouterAliment')} libelle={t('ajouterAliment')} libelleFermer={t('fermer')} onFermer={onFermer}>
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
            {onglet === 'scanner' && <Scanner langue={langue} t={t} onTrouve={setChoisi} onCreer={(produit) => { setPrerempli(produit); setOnglet('manuel') }} />}
            {onglet === 'recherche' && <Recherche langue={langue} t={t} locale={locale} onChoisir={setChoisi} />}
            {onglet === 'recents' && <ListeAliments aliments={alimentsRecents} vide={t('aucunRecent')} t={t} locale={locale} onChoisir={setChoisi} />}
            {onglet === 'manuel' && <SaisieManuelle key={prerempli?.code ?? 'libre'} t={t} prerempli={prerempli} onValider={setChoisi} />}
          </div>
        </>
      )}
    </FeuilleMobile>
  )
}

type EtatScanner = 'demarrage' | 'lecture' | 'recherche' | 'refus' | 'camera' | 'introuvable' | 'erreur'

function Scanner({ langue, t, onTrouve, onCreer }: { langue: Langue; t: Traducteur; onTrouve: (aliment: Aliment) => void; onCreer: (produit: ProduitPartiel) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [etat, setEtat] = useState<EtatScanner>('demarrage')
  const [essai, setEssai] = useState(0)
  const [dernierCode, setDernierCode] = useState('')
  const [codeManuel, setCodeManuel] = useState('')
  const [partiel, setPartiel] = useState<ProduitPartiel | null>(null)

  const chercherCode = useCallback(async (code: string) => {
    setEtat('recherche')
    setDernierCode(code)
    setPartiel(null)
    const resultat = await chercherCodeBarres(code, langue)
    if (resultat === 'erreur') {
      setEtat('erreur')
      return
    }
    if ('aliment' in resultat) {
      onTrouve(resultat.aliment)
      return
    }
    setPartiel(resultat.partiel)
    setEtat('introuvable')
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
    introuvable: partiel?.nom ? t('produitSansValeurs', { nom: partiel.nom }) : t('produitInconnu', { code: dernierCode }),
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

      {etat === 'introuvable' && (
        <button
          onClick={() => onCreer(partiel ?? { code: dernierCode, nom: null, marque: null, portionG: null })}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" /> {t('ajouterCeProduit')}
        </button>
      )}

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
      const [r, perso] = await Promise.all([appelerApi(new URLSearchParams({ q: requete, lang: langue })), chercherAlimentsPerso(requete)])
      if (annule) return
      if (r === 'erreur' && perso.length === 0) {
        setEtat('erreur')
        return
      }
      // Produits saisis par le compte en tête, sans doublon de code-barres.
      const codesPerso = new Set(perso.map((a) => a.code))
      setResultats([...perso, ...(r === 'erreur' ? [] : r.filter((a) => !a.code || !codesPerso.has(a.code)))])
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

function SaisieManuelle({ t, prerempli, onValider }: { t: Traducteur; prerempli: ProduitPartiel | null; onValider: (aliment: Aliment) => void }) {
  const [nom, setNom] = useState(prerempli?.nom ?? '')
  const [marque, setMarque] = useState(prerempli?.marque ?? '')
  const [kcal, setKcal] = useState('')
  const [prot, setProt] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const k = Number.parseFloat(kcal.replace(',', '.'))
  const p = Number.parseFloat(prot.replace(',', '.'))
  const valide = nom.trim().length > 0 && Number.isFinite(k) && k >= 0 && k <= 1000 && Number.isFinite(p) && p >= 0 && p <= 100
  // 16 px minimum : en dessous, Safari iOS zoome toute la page quand le champ prend le focus.
  const classeChamp = 'h-12 w-full rounded-xl bg-secondary px-3 text-base font-bold text-foreground outline-none'

  const valider = async () => {
    if (!valide || envoi) return
    const aliment: Aliment = { code: prerempli?.code ?? null, nom: nom.trim().slice(0, 200), marque: marque.trim().slice(0, 200) || null, kcal100: k, prot100: p, portionG: prerempli?.portionG ?? null }
    if (aliment.code) {
      setEnvoi(true)
      // Mémorisé pour ce compte : le prochain scan de ce code le trouvera directement.
      const { error } = await supabase.from('aliments_perso').upsert(
        [{ code_barres: aliment.code, nom: aliment.nom, marque: aliment.marque, kcal_100g: aliment.kcal100, proteines_100g: aliment.prot100, portion_g: aliment.portionG, modifie_le: new Date().toISOString() }],
        { onConflict: 'user_id,code_barres' },
      )
      setEnvoi(false)
      if (error && error.code !== 'PGRST205') toast(t('produitNonMemorise'), 'info')
    }
    onValider(aliment)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void valider()
      }}
      className="space-y-3"
    >
      {prerempli?.code && (
        <p className="rounded-xl bg-secondary p-3 text-xs font-bold text-muted-foreground">{t('memoriseProchainScan', { code: prerempli.code })}</p>
      )}
      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('nomAliment')}</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={200} className={classeChamp} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('marqueFacultative')}</span>
        <input value={marque} onChange={(e) => setMarque(e.target.value)} maxLength={200} className={classeChamp} />
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
      <button type="submit" disabled={!valide || envoi} className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40">
        {envoi ? <RefreshCw className="size-4 animate-spin" /> : t('continuer')}
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
        <Total libelle={t('calories')} valeur={kcal} arrondir={arrondi} unite="kcal" objectif={null} depasserReussit={false} t={t} locale={locale} />
        <Total libelle={t('proteines')} valeur={prot} arrondir={arrondi1} unite="g" objectif={null} depasserReussit t={t} locale={locale} />
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
