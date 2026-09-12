'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/power/header'
import { WeekCalendar } from '@/components/power/week-calendar'
import SessionForm from '@/components/power/session-form'
import { Card, CardTitle } from '@/components/power/card'
import { LineChart, RefreshCw } from 'lucide-react'
import { toast } from '@/components/power/toaster'
import { cn } from '@/lib/utils'
import { toLocalDateStr, parseLocalDate, weeksOut, type UpcomingCompetition, type ModeApp } from '@/lib/powerlifting'
import { ThemeProvider, type Langue } from './ThemeContext'
import { EcranConnexion } from '@/components/power/ecran-connexion'
import { BarreNavigation } from '@/components/power/barre-navigation'
import { purgerRecordsLocaux, type AuthUser } from '@/lib/compte'
import { vueDepuisUrl, type Vue } from '@/lib/navigation'
import { traducteurPour, langueDuProfil, LOCALES } from '@/lib/i18n'
import dynamic from 'next/dynamic'

interface TrainingBlockRow {
  id: string;
  block_number: number;
  start_date: string;
  duration_weeks: number | null;
  name?: string | null;
}

// Écrans chargés à la demande : l'accueil n'embarque pas le code de ceux
// qu'on n'ouvre pas (graphiques, palmarès, nutrition, photos, outils).
const enChargement = () => (
  <div className="flex justify-center py-16 text-muted-foreground"><RefreshCw className="size-5 animate-spin" /></div>
)
const StatsCards = dynamic(() => import('@/components/power/stats-cards').then((m) => m.StatsCards), { loading: enChargement })
const LiftProgressChart = dynamic(() => import('@/components/power/lift-progress-chart').then((m) => m.LiftProgressChart), { loading: enChargement })
const BodyweightTracker = dynamic(() => import('@/components/power/bodyweight-tracker').then((m) => m.BodyweightTracker), { loading: enChargement })
const PlateVisualizer = dynamic(() => import('@/components/power/plate-visualizer').then((m) => m.PlateVisualizer), { loading: enChargement })
const WarmupGenerator = dynamic(() => import('@/components/power/warmup-generator').then((m) => m.WarmupGenerator), { loading: enChargement })
const ChangePasswordModal = dynamic(() => import('@/components/power/change-password-modal'), { loading: enChargement })
const CircuitTimer = dynamic(() => import('@/components/power/circuit-timer'), { loading: enChargement })
const ConfigPanel = dynamic(() => import('@/components/power/config-panel'), { loading: enChargement })
const CalculatorPanel = dynamic(() => import('@/components/power/calculator-panel'), { loading: enChargement })
const GLCalculator = dynamic(() => import('@/components/power/GLCalculator'), { loading: enChargement })
const Palmares = dynamic(() => import('@/components/power/palmares').then((m) => m.Palmares), { loading: enChargement })
const Classement = dynamic(() => import('@/components/power/classement').then((m) => m.Classement), { loading: enChargement })
const Nutrition = dynamic(() => import('@/components/power/nutrition').then((m) => m.Nutrition), { loading: enChargement })
const GaleriePhotos = dynamic(() => import('@/components/power/galerie-photos').then((m) => m.GaleriePhotos), { loading: enChargement })

export default function Page() {
  const [session, setSession] = useState<AuthUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  
  const [isRestDayMode, setIsRestDayMode] = useState(false)
  // Pas rattachés à leur date : une autre date n'affiche rien tant que les siens ne sont pas chargés.
  const [pasCharges, setPasCharges] = useState<{ date: string; pas: number | null } | null>(null)
  // ?steps=N (raccourci iPhone) : annoncé une fois la langue du profil connue.
  const pasASignaler = useRef<number | null>(null)
  
  const [dateActive, setDateActive] = useState<Date>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('date')
      if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return parseLocalDate(param)
    }
    return new Date()
  })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showCircuitTimer, setShowCircuitTimer] = useState(false)
  
  const [vueActive, setVueActive] = useState<Vue>(vueDepuisUrl)

  const [editCompId, setEditCompId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('editComp')
    return null
  })
  const [nextCompetition, setNextCompetition] = useState<UpcomingCompetition | null>(null)

  const [theme, setTheme] = useState('dark')
  const [mode, setMode] = useState<ModeApp>('powerlifting')
  const [prenom, setPrenom] = useState<string | null>(null)
  const [langue, setLangue] = useState<Langue>('fr')
  const estFitness = mode === 'fitness'
  // page.tsx rend le ThemeProvider : il ne peut pas consommer son contexte,
  // il construit donc son traducteur directement depuis son propre etat.
  const t = useMemo(() => traducteurPour(langue), [langue])

  const vientDeSeConnecter = useRef(false)

  useEffect(() => {
    if (!session?.id) return
    let cancelled = false
    const fetchProfil = async () => {
      const { data } = await supabase.from('profiles').select('theme, mode, prenom, langue').eq('id', session.id).single()
      if (cancelled) return
      setTheme(data?.theme ?? 'dark')
      setMode(data?.mode === 'fitness' ? 'fitness' : 'powerlifting')
      setPrenom(data?.prenom ?? null)
      const langueProfil = langueDuProfil(data?.langue)
      setLangue(langueProfil)
      const tProfil = traducteurPour(langueProfil)

      // Prénom et langue ne sont connus qu'après cette requête : les messages
      // d'accueil ne peuvent pas partir plus tôt.
      if (vientDeSeConnecter.current && data?.prenom) {
        vientDeSeConnecter.current = false
        toast(tProfil('bienvenue', { prenom: data.prenom }), 'success')
      }
      if (pasASignaler.current !== null) {
        toast(tProfil('pasSynchronises', { n: pasASignaler.current.toLocaleString(LOCALES[langueProfil]) }), 'success')
        pasASignaler.current = null
      }
    }
    fetchProfil()
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const fetchNextCompetition = async () => {
      const { data } = await supabase
        .from('competitions')
        .select('id, name, date, level, country_code')
        .gte('date', toLocalDateStr(new Date()))
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!cancelled) setNextCompetition(data ?? null)
    }
    fetchNextCompetition()
    return () => { cancelled = true }
  }, [session])

  const dateActiveStr = toLocalDateStr(dateActive)
  const pasDuJour = pasCharges?.date === dateActiveStr ? pasCharges.pas : null

  useEffect(() => {
    if (!session) return
    let cancelled = false
    // Filtré par compte côté base (RLS) : seules les lignes du compte connecté remontent.
    supabase.from('seances_pas').select('pas').eq('date', dateActiveStr).maybeSingle().then(({ data, error }) => {
      if (!cancelled && !error) setPasCharges({ date: dateActiveStr, pas: data?.pas ?? null })
    })
    return () => { cancelled = true }
  }, [session, dateActiveStr])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1])
    const pasUrl = Number.parseInt(params.get('steps') ?? '', 10)
    if (Number.isFinite(pasUrl) && pasUrl >= 0) {
      pasASignaler.current = pasUrl
      window.history.replaceState({}, '', window.location.pathname)
    }

    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('sb-')) window.localStorage.removeItem(key)
      }
    } catch { }

    fetch('/api/auth/session')
      .then(async (res) => (res.ok ? ((await res.json()) as { user: AuthUser | null }).user : null))
      .catch(() => null)
      .then((user) => {
        // Aucune purge ici : une session expirée, une coupure réseau ou une
        // limite de débit renvoient null, et les records saisis à la main
        // étaient effacés au passage. Ils ne partent qu'à la déconnexion.
        setSession(user)
        setLoadingAuth(false)
      })
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    purgerRecordsLocaux()
    setSession(null)
  }

  const changerVue = (vue: Vue) => {
    setVueActive(vue)
    window.history.pushState({}, '', `?page=${vue}`);
  }

  const ouvrirSeance = (dateStr: string) => {
    setDateActive(parseLocalDate(dateStr))
    setVueActive('accueil')
    window.history.pushState({}, '', `?page=accueil&date=${dateStr}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ouvrirResultatsCompetition = (competitionId: string) => {
    setVueActive('palmares')
    setEditCompId(competitionId)
    window.history.pushState({}, '', `?page=palmares&editComp=${competitionId}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handlePopState = () => setVueActive(vueDepuisUrl())
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [blocks, setBlocks] = useState<TrainingBlockRow[] | null>(null)

  useEffect(() => {
    if (!session) return;
    let cancelled = false
    const fetchBlocks = async () => {
      const { data } = await supabase
        .from('training_blocks')
        .select('*')
        .order('start_date', { ascending: true })
      if (!cancelled) setBlocks((data ?? []) as TrainingBlockRow[])
    }
    fetchBlocks()
    return () => { cancelled = true }
  }, [session, vueActive])

  const blockInfo = useMemo(() => {
    if (blocks === null) return '...'
    if (blocks.length === 0) return t('aucunBloc')
    const cible = parseLocalDate(dateActiveStr)
    // Blocs triés par date de début : le bloc en cours est le dernier déjà commencé.
    const commences = blocks.filter((b) => parseLocalDate(b.start_date) <= cible)
    const actif = commences[commences.length - 1]
    if (!actif) return t('enAttenteBloc1')
    const duree = actif.duration_weeks || 5
    // Arrondi et non troncature : un jour de changement d'heure dure 23 ou 25 h.
    const jours = Math.round((cible.getTime() - parseLocalDate(actif.start_date).getTime()) / 86_400_000)
    const v = { n: actif.block_number, s: Math.floor(jours / 7) + 1, d: duree }
    if (v.s > duree) return t('blocTermine', v)
    return t(v.s === duree ? 'blocSemaineMax' : 'blocSemaine', v)
  }, [blocks, dateActiveStr, t])

  if (loadingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <RefreshCw className="size-8 text-foreground animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <EcranConnexion t={t} onConnecte={(user) => { vientDeSeConnecter.current = true; setSession(user) }} />
  }

  return (
    <ThemeProvider theme={theme} mode={mode} prenom={prenom} langue={langue}>
      <div className="min-h-dvh bg-background pb-16 relative">
        {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
        {showCircuitTimer && <CircuitTimer onClose={() => setShowCircuitTimer(false)} />}
        <Header />

        <BarreNavigation
          vueActive={vueActive}
          onChangerVue={changerVue}
          estFitness={estFitness}
          onChrono={() => setShowCircuitTimer(true)}
          onMotDePasse={() => setShowPasswordModal(true)}
          onDeconnexion={handleLogout}
        />

        <main className="mx-auto max-w-5xl space-y-6 px-4 py-4">
          {vueActive === 'configuration' && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <ConfigPanel />
            </div>
          )}

          {vueActive === 'calculatrice' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CalculatorPanel />
              {!estFitness && <GLCalculator />}
            </div>
          )}

          {vueActive === 'palmares' && !estFitness && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Palmares initialEditId={editCompId} onInitialEditConsumed={() => setEditCompId(null)} />
            </div>
          )}

          {vueActive === 'classement' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Classement />
            </div>
          )}

          {vueActive === 'nutrition' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Nutrition />
            </div>
          )}

          {vueActive === 'photos' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <GaleriePhotos onOuvrirSeance={ouvrirSeance} />
            </div>
          )}

          {vueActive === 'accueil' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {new Date().getDay() === 0 && (
                <button
                  onClick={() => changerVue('classement')}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl border border-primary bg-card p-4 text-left transition-colors hover:bg-secondary"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="text-2xl leading-none" aria-hidden>🏆</span>
                    <span className="text-sm font-black text-foreground">{t('dimancheBanniere')}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('voirPodium')} →</span>
                </button>
              )}
              <WeekCalendar
                dateActive={dateActive}
                setDateActive={setDateActive}
                blockTitle={blockInfo}
                weeksOut={!estFitness && nextCompetition && toLocalDateStr(dateActive) <= nextCompetition.date ? weeksOut(toLocalDateStr(dateActive), nextCompetition.date) : null}
              />
              <SessionForm
                dateActive={dateActive}
                isRestDayMode={isRestDayMode}
                setIsRestDayMode={setIsRestDayMode}
                pasDuJour={pasDuJour}
                setDateActive={setDateActive}
                nextCompetition={estFitness ? null : nextCompetition}
                onGoToPalmares={ouvrirResultatsCompetition}
              />
            </div>
          )}

          {vueActive === 'analytique' && (
            <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StatsCards />
              <Card>
                <CardTitle icon={LineChart} title={estFitness ? t('progressionCharges') : t('progressionLifts')} hint={t('indicesGraphique')} />
                <LiftProgressChart onSelectSession={ouvrirSeance} />
              </Card>
              <BodyweightTracker />
            </section>
          )}

          {vueActive === 'outils' && (
            <div className="grid gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PlateVisualizer />
              <WarmupGenerator />
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  )
}