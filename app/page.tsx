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
import { LineChart, Menu, X, Home, BarChart2, Wrench, Settings, Calculator, Lock, LogOut, RefreshCw, User, History, KeyRound, Timer, Shield, Trash2, Trophy } from 'lucide-react'
import ChangePasswordModal from '@/components/power/change-password-modal'
import CircuitTimer from '@/components/power/circuit-timer'
import { toast } from '@/components/power/toaster'
import { cn } from '@/lib/utils'
import { toLocalDateStr } from '@/lib/powerlifting'
import ConfigPanel from '@/components/power/config-panel'
import CalculatorPanel from '@/components/power/calculator-panel'
import HistoryPanel from '@/components/power/history-panel'
import GLCalculator from '@/components/power/GLCalculator';
import { Palmares } from '@/components/power/palmares'

// Utilisateur connecté tel que renvoyé par /api/auth/session.
// Les jetons, eux, restent dans des cookies httpOnly : jamais côté JS.
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
  
  const [dateActive, setDateActive] = useState<Date>(new Date())
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

  const menuRef = useRef<HTMLDivElement>(null)
  const toggleBtnRef = useRef<HTMLButtonElement>(null)

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

    // Identifiant de sync : celui que le raccourci iPhone envoie en `userId`.
    // Configurable via NEXT_PUBLIC_SYNC_USER_ID, sinon dérivé de l'identifiant
    // de connexion (partie locale de l'email fantôme).
    const syncUserId = process.env.NEXT_PUBLIC_SYNC_USER_ID || session.email?.split('@')[0]
    if (!syncUserId) return;

    // Reset immédiat : pendant la navigation entre jours, on n'affiche jamais
    // les pas d'une autre journée en attendant la réponse réseau.
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
        console.error("Erreur de récupération des pas (seances_pas) :", error);
      } else {
        setPasDuJour(data?.pas ?? null);
      }
    };

    fetchStepsForSelectedDate();
    return () => { cancelled = true };
  }, [session, dateActive]);

  useEffect(() => {
    // Purge des sessions héritées de l'ancien stockage localStorage : plus
    // aucun jeton ne doit rester lisible par le JavaScript de la page.
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('sb-')) window.localStorage.removeItem(key)
      }
    } catch { /* stockage inaccessible (navigation privée) : rien à purger */ }

    fetch('/api/auth/session')
      .then(async (res) => (res.ok ? ((await res.json()) as { user: AuthUser | null }).user : null))
      .catch(() => null)
      .then((user) => {
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
        // Message précis du serveur (ex. blocage temporaire après trop d'échecs)
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? '')
      }
      const { user } = (await res.json()) as { user: AuthUser }
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
    setSession(null)
  }


  // RGPD Art. 17 : effacement du compte (irréversible)
  const handleDeleteAccount = async () => {
    if (!confirm("Supprimer définitivement ton compte ? Tes pas synchronisés seront effacés et tu seras déconnecté. Cette action est irréversible.")) return
    await fetch('/api/account/delete', { method: 'POST' }).catch(() => {})
    setSession(null)
  }

  const changerVue = (vue: string) => {
    setVueActive(vue)
    setMenuOuvert(false)
    window.history.pushState({}, '', `?page=${vue}`);
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

  // Les blocs sont chargés à la connexion et au retour de la vue Configuration
  // (plus de re-fetch réseau à chaque changement de jour dans le calendrier).
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
        <RefreshCw className="size-8 text-white animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-sm p-8 rounded-2xl border border-zinc-900 bg-zinc-950/80 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-zinc-900 text-white rounded-full mb-4 ring-1 ring-zinc-800">
              <Lock className="size-8" />
            </div>
            <h1 className="text-2xl font-black text-white">Accès Réservé</h1>
            <p className="text-sm text-zinc-500 mt-1">Saisis tes identifiants</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg text-center">
                {authError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <User className="size-3" /> Identifiant
              </label>
              <input
                type="text"
                placeholder="Ex: 1"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                className="w-full p-3 bg-black border border-zinc-800 rounded-lg text-white font-bold outline-none focus:border-white transition-colors placeholder:text-zinc-700"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="size-3" /> Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-black border border-zinc-800 rounded-lg text-white font-bold outline-none focus:border-white transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 mt-4 bg-white hover:bg-zinc-200 text-black font-black rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex justify-center items-center gap-2"
            >
              {isLoggingIn ? <RefreshCw className="size-5 animate-spin" /> : "DÉVERROUILLER"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background pb-16 relative">
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showCircuitTimer && <CircuitTimer onClose={() => setShowCircuitTimer(false)} />}
      <Header />

      <div className="mx-auto max-w-5xl px-4 pt-4 flex justify-between items-center relative z-50">
        
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-muted-foreground capitalize">
            {/* Vue accueil : pas de sous-titre — le calendrier et le formulaire
                se suffisent (l'ancien "Séance & Calendrier" faisait doublon). */}
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
                : "bg-secondary/50 border-border hover:bg-secondary text-slate-400 hover:text-white"
            )}
            title="Retour à l'accueil"
          >
            <Home className="size-5" />
          </button>

          <div className="relative">
            <button 
              ref={toggleBtnRef}
              onClick={() => setMenuOuvert(!menuOuvert)} 
              className="flex items-center justify-center p-2 rounded-md bg-secondary/50 hover:bg-secondary border border-border transition-colors"
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
                <button onClick={() => changerVue('historique')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'historique' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><History className="size-4" /> Historique</button>
                <button onClick={() => changerVue('palmares')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'palmares' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Trophy className="size-4" /> Palmarès</button>
                <button onClick={() => { setShowCircuitTimer(true); setMenuOuvert(false) }} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary text-foreground"><Timer className="size-4" /> Chrono Circuit</button>

                <div className="h-px bg-border my-1"></div>
                
                <button onClick={() => changerVue('configuration')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'configuration' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Settings className="size-4" /> Mes Blocs</button>
                
                <div className="h-px bg-border my-1"></div>

                <button onClick={() => { setShowPasswordModal(true); setMenuOuvert(false) }} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary text-foreground">
                  <KeyRound className="size-4" /> Mot de passe
                </button>

                <a href="/confidentialite" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-secondary text-foreground">
                  <Shield className="size-4" /> Confidentialité
                </a>
                <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-red-500/10 text-red-400 font-medium">
                  <LogOut className="size-4" /> Se déconnecter
                </button>
                <button onClick={handleDeleteAccount} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-red-500/10 text-red-500 font-medium">
                  <Trash2 className="size-4" /> Supprimer mon compte
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
            <GLCalculator />
          </div>
        )}

        {vueActive === 'palmares' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Palmares />
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
            />
            <SessionForm 
              dateActive={dateActive} 
              isRestDayMode={isRestDayMode}
              setIsRestDayMode={setIsRestDayMode} 
              pasDuJour={pasDuJour}
            />
          </div>
        )}

        {vueActive === 'analytique' && (
          <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StatsCards />
            <Card>
              <CardTitle icon={LineChart} title="Progression des lifts" hint="Tonnage hebdo · Top set · Douleur" />
              <LiftProgressChart />
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
  )
}