'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/power/header'
import { StatsCards } from '@/components/power/stats-cards'
import { LiftProgressChart } from '@/components/power/lift-progress-chart'
import { BodyweightTracker } from '@/components/power/bodyweight-tracker'
import { WeekCalendar } from '@/components/power/week-calendar'
import SessionForm from '@/components/power/session-form'
import { PlateVisualizer } from '@/components/power/plate-visualizer'
import { WarmupGenerator } from '@/components/power/warmup-generator'
import { Card, CardTitle } from '@/components/power/card'
import { LineChart, Menu, X, Home, BarChart2, Wrench, Settings, Calculator, Lock, LogOut, RefreshCw, User, KeyRound, Timer, Trophy } from 'lucide-react'
import ChangePasswordModal from '@/components/power/change-password-modal'
import CircuitTimer from '@/components/power/circuit-timer'
import { toast } from '@/components/power/toaster'
import { cn } from '@/lib/utils'
import { toLocalDateStr, weeksOut, type UpcomingCompetition, type ModeApp } from '@/lib/powerlifting'
import ConfigPanel from '@/components/power/config-panel'
import CalculatorPanel from '@/components/power/calculator-panel'
import HistoryPanel from '@/components/power/history-panel'
import GLCalculator from '@/components/power/GLCalculator';
import { Palmares } from '@/components/power/palmares'
import { ThemeProvider, type Langue } from './ThemeContext'

interface AuthUser {
  id: string;
  email: string | null;
}

interface TrainingBlockRow {
  id: string;
  block_number: number;
  start_date: string;
  duration_weeks: number | null;
  name?: string | null;
}

export default function Page() {
  const [session, setSession] = useState<AuthUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  const [isRestDayMode, setIsRestDayMode] = useState(false)
  const [pasDuJour, setPasDuJour] = useState<number | null>(null);
  
  const [dateActive, setDateActive] = useState<Date>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('date')
      if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
        const [annee, mois, jour] = param.split('-').map(Number)
        return new Date(annee, mois - 1, jour)
      }
    }
    return new Date()
  })
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showCircuitTimer, setShowCircuitTimer] = useState(false)
  const [blockInfo, setBlockInfo] = useState('Chargement...')
  
  const [vueActive, setVueActive] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('page') || 'accueil';
    }
    return 'accueil';
  });

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

  const menuRef = useRef<HTMLDivElement>(null)
  const toggleBtnRef = useRef<HTMLButtonElement>(null)
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
      setLangue(data?.langue === 'ca' ? 'ca' : 'fr')

      // Le prénom n'est connu qu'après cette requête : l'accueil ne peut
      // donc pas être affiché au moment de la soumission du formulaire.
      if (vientDeSeConnecter.current && data?.prenom) {
        vientDeSeConnecter.current = false
        toast(data.langue === 'ca' ? `Benvinguda, ${data.prenom} !` : `Bienvenue, ${data.prenom} !`, 'success')
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
      const stepsEnregistres = urlParams.get('steps');

      if (stepsEnregistres) {
        const nombreDePas = parseInt(stepsEnregistres, 10);
        setPasDuJour(nombreDePas);
        toast(`Pas synchronisés depuis l'iPhone : ${nombreDePas.toLocaleString('fr-FR')} pas`, 'success');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // Le compte est désigné par le préfixe d'email, comme partout ailleurs.
    // L'ancien identifiant de synchro était commun aux deux comptes.
    const syncUserId = session.email?.split('@')[0]
    if (!syncUserId) return;

    setPasDuJour(null);
    let cancelled = false;

    const fetchStepsForSelectedDate = async () => {
      const dateStr = toLocalDateStr(dateActive);
      const { data, error } = await supabase
        .from('seances_pas')
        .select('pas')
        .eq('user_id', syncUserId)
        .eq('date', dateStr)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("Erreur de récupération des pas :", error);
      } else {
        setPasDuJour(data?.pas ?? null);
      }
    };

    fetchStepsForSelectedDate();
    return () => { cancelled = true };
  }, [session, dateActive]);

  useEffect(() => {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('sb-')) window.localStorage.removeItem(key)
      }
    } catch { }

    fetch('/api/auth/session')
      .then(async (res) => (res.ok ? ((await res.json()) as { user: AuthUser | null }).user : null))
      .catch(() => null)
      .then((user) => {
        if (!user) {
          // Purge à la déconnexion : les records saisis à la main ne
          // doivent pas rester visibles pour le compte suivant.
          try {
            for (const cle of ['mota_real_prs', 'mota_real_prs_powerlifting', 'mota_real_prs_fitness']) {
              window.localStorage.removeItem(cle)
            }
          } catch { }
        }
        setSession(user)
        setLoadingAuth(false)
      })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setAuthError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiant, password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? '')
      }
      const { user } = (await res.json()) as { user: AuthUser }
      vientDeSeConnecter.current = true
      setSession(user)
      setPassword('')
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : ''
      setAuthError(message || "Identifiant ou mot de passe incorrect.")
    }
    setIsLoggingIn(false)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    try { window.localStorage.removeItem('mota_real_prs') } catch { }
    setSession(null)
  }

  const changerVue = (vue: string) => {
    setVueActive(vue)
    setMenuOuvert(false)
    window.history.pushState({}, '', `?page=${vue}`);
  }

  const ouvrirSeance = (dateStr: string) => {
    const [annee, mois, jour] = dateStr.split('-').map(Number)
    setDateActive(new Date(annee, mois - 1, jour))
    setVueActive('accueil')
    setMenuOuvert(false)
    window.history.pushState({}, '', `?page=accueil&date=${dateStr}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ouvrirResultatsCompetition = (competitionId: string) => {
    setVueActive('palmares')
    setEditCompId(competitionId)
    setMenuOuvert(false)
    window.history.pushState({}, '', `?page=palmares&editComp=${competitionId}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!session) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        toggleBtnRef.current && !toggleBtnRef.current.contains(event.target as Node)
      ) {
        setMenuOuvert(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [session])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setVueActive(params.get('page') || 'accueil');
    };
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

  useEffect(() => {
    if (!session || blocks === null) return;

    if (blocks.length === 0) {
      setBlockInfo('Aucun bloc planifié')
      return
    }

    const targetDate = new Date(dateActive)
    targetDate.setHours(0, 0, 0, 0)

    let activeBlock: TrainingBlockRow | null = null;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const blockDate = new Date(blocks[i].start_date)
      blockDate.setHours(0, 0, 0, 0)
      if (targetDate >= blockDate) {
        activeBlock = blocks[i];
        break;
      }
    }

    if (activeBlock) {
      const startDate = new Date(activeBlock.start_date)
      startDate.setHours(0, 0, 0, 0)
      const duration = activeBlock.duration_weeks || 5
      const diffTime = Math.abs(targetDate.getTime() - startDate.getTime())
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      const currentWeek = Math.floor(diffDays / 7) + 1

      if (currentWeek > duration) {
        setBlockInfo(`Bloc ${activeBlock.block_number} terminé (S${currentWeek})`)
      } else if (currentWeek === duration) {
        setBlockInfo(`🔥 Bloc ${activeBlock.block_number} | Semaine ${currentWeek} / ${duration} (MAX)`)
      } else {
        setBlockInfo(`Bloc ${activeBlock.block_number} | Semaine ${currentWeek} / ${duration}`)
      }
    } else {
      setBlockInfo('En attente du Bloc 1')
    }
  }, [dateActive, blocks, session])

  if (loadingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <RefreshCw className="size-8 text-foreground animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-foreground/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-sm p-8 rounded-2xl border border-border bg-card/80 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-secondary text-foreground rounded-full mb-4 ring-1 ring-border">
              <Lock className="size-8" />
            </div>
            <h1 className="text-2xl font-black text-foreground">Accès Réservé</h1>
            <p className="text-sm text-muted-foreground mt-1">Saisis tes identifiants</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold rounded-lg text-center">
                {authError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="size-3" /> Identifiant
              </label>
              <input
                type="text"
                placeholder="Ex: 1"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                className="w-full p-3 bg-input border border-border rounded-lg text-foreground font-bold outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Lock className="size-3" /> Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-input border border-border rounded-lg text-foreground font-bold outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 mt-4 bg-primary hover:opacity-90 text-primary-foreground font-black rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex justify-center items-center gap-2"
            >
              {isLoggingIn ? <RefreshCw className="size-5 animate-spin" /> : "DÉVERROUILLER"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider theme={theme} mode={mode} prenom={prenom} langue={langue}>
      <div className="min-h-dvh bg-background pb-16 relative">
        {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
        {showCircuitTimer && <CircuitTimer onClose={() => setShowCircuitTimer(false)} />}
        <Header />

        <div className="mx-auto max-w-5xl px-4 pt-4 flex justify-between items-center relative z-30 bg-background">
          
          <div className="flex flex-col">
            <h2 className="text-sm font-medium text-muted-foreground capitalize">
              {vueActive === 'analytique' && "Tableau de bord"}
              {vueActive === 'outils' && "Outils & Échauffement"}
              {vueActive === 'calculatrice' && "Calculateur de force"}
              {vueActive === 'historique' && "Historique des Mouvements"}
              {vueActive === 'configuration' && "Gestion de mes Blocs"}
              {vueActive === 'palmares' && "Palmarès"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            
            <button 
              onClick={() => changerVue('accueil')} 
              className={cn(
                "flex items-center justify-center p-2 rounded-md border transition-colors",
                vueActive === 'accueil' 
                  ? "bg-primary/10 border-primary/20 text-primary" 
                  : "bg-secondary border-border hover:bg-accent text-muted-foreground hover:text-accent-foreground"
              )}
              title="Retour à l'accueil"
            >
              <Home className="size-5" />
            </button>

            <div className="relative">
              <button 
                ref={toggleBtnRef}
                onClick={() => setMenuOuvert(!menuOuvert)} 
                className="flex items-center justify-center p-2 rounded-md bg-secondary hover:bg-accent border border-border transition-colors text-foreground"
              >
                {menuOuvert ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>

              {menuOuvert && (
                <div 
                  ref={menuRef}
                  className="absolute top-12 right-0 w-56 bg-card border border-border p-2 rounded-lg shadow-xl flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-200"
                >
                  <button onClick={() => changerVue('analytique')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'analytique' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><BarChart2 className="size-4" /> Analytique</button>
                  <button onClick={() => changerVue('outils')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'outils' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Wrench className="size-4" /> Outils</button>
                  <button onClick={() => changerVue('calculatrice')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'calculatrice' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Calculator className="size-4" /> Calculatrice</button>
                  {!estFitness && (
                    <button onClick={() => changerVue('palmares')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'palmares' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Trophy className="size-4" /> Palmarès</button>
                  )}
                  <button onClick={() => { setShowCircuitTimer(true); setMenuOuvert(false) }} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary text-foreground"><Timer className="size-4" /> Chrono Circuit</button>

                  <div className="h-px bg-border my-1"></div>
                  
                  <button onClick={() => changerVue('configuration')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'configuration' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Settings className="size-4" /> Mes Blocs</button>
                  
                  <div className="h-px bg-border my-1"></div>

                  <button onClick={() => { setShowPasswordModal(true); setMenuOuvert(false) }} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary text-foreground">
                    <KeyRound className="size-4" /> Mot de passe
                  </button>

                  <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-destructive/10 text-destructive font-medium">
                    <LogOut className="size-4" /> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

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

          {vueActive === 'historique' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <HistoryPanel />
            </div>
          )}

          {vueActive === 'accueil' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                <CardTitle icon={LineChart} title="Progression des lifts" hint="Tonnage · Top set · e1RM · Douleur" />
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