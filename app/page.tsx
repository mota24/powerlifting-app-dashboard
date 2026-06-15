'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase' 
import { Header } from '@/components/power/header'
import { StatsCards } from '@/components/power/stats-cards'
import { AnalyticsChart } from '@/components/power/analytics-chart'
import { WeekCalendar } from '@/components/power/week-calendar'
import SessionForm from '@/components/power/session-form'
import { PlateVisualizer } from '@/components/power/plate-visualizer'
import { WarmupGenerator } from '@/components/power/warmup-generator'
import { Card, CardTitle } from '@/components/power/card'
import { LineChart, Menu, X, Home, BarChart2, Wrench, Settings, Calculator, Lock, LogOut, RefreshCw, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfigPanel from '@/components/power/config-panel'
import CalculatorPanel from '@/components/power/calculator-panel'
import GLCalculator from '@/components/power/GLCalculator';

export default function Page() {
  const [session, setSession] = useState<any>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // NOUVEAU : La page globale connaît maintenant le mode repos
  const [isRestDayMode, setIsRestDayMode] = useState(false)
  const [pasDuJour, setPasDuJour] = useState<number | null>(null);
  useEffect(() => {
    // On s'assure qu'on est sur le navigateur
    if (typeof window !== 'undefined') {
      // Ce code fouille dans l'URL pour trouver "steps=..."
      const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
      const stepsEnregistres = urlParams.get('steps');

      if (stepsEnregistres) {
        const nombreDePas = parseInt(stepsEnregistres, 10);//hol
        setPasDuJour(nombreDePas);
        
        // On affiche une alerte pour TE PROUVER que le chiffre est bien arrivé
        alert("Succès ! L'iPhone a envoyé : " + nombreDePas + " pas.");
        
        // On nettoie l'URL pour faire propre
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);
  // Ajoute ce useEffect dans ton composant Pagesdvx
// ... dans ton app/page.tsx, trouve ton useEffect pour fetchTodaySteps

  useEffect(() => {
    if (!session) return;

    const fetchTodaySteps = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('seances_pas')
        .select('pas')
        .eq('date', today)
        .eq('user_id', 'mota24')
        .order('date', { ascending: false });

      // C'EST ICI QUE TU COPIES LE BLOC :
      if (error) {
        console.error("Erreur de récupération :", error);
      } else if (data && data.length > 0) {
        console.log("Données reçues de Supabase :", data);
        setPasDuJour(data[0].pas); 
      } else {
        console.log("Aucune donnée trouvée pour cette date.");
      }
    };

    fetchTodaySteps();
  }, [session]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingAuth(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])
  

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setAuthError('')
    
    const emailFantome = `${identifiant.trim().toLowerCase()}@power.app`
    
    const { error } = await supabase.auth.signInWithPassword({
      email: emailFantome,
      password,
    })
    
    if (error) {
      setAuthError("Identifiant ou mot de passe incorrect.")
    }
    setIsLoggingIn(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const [vueActive, setVueActive] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('page') || 'accueil';
    }
    return 'accueil';
  });

  const [menuOuvert, setMenuOuvert] = useState(false)
  const [dateActive, setDateActive] = useState<Date>(new Date())
  const [blockInfo, setBlockInfo] = useState('Chargement...')
  
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleBtnRef = useRef<HTMLButtonElement>(null)

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

  useEffect(() => {
    if (!session) return;
    
    const calculateCurrentWeek = async () => {
      const { data } = await supabase
        .from('training_blocks')
        .select('*')
        .order('block_number', { ascending: true })

      if (!data || data.length === 0) {
        setBlockInfo('Aucun bloc planifié')
        return
      }

      const targetDate = new Date(dateActive)
      targetDate.setHours(0, 0, 0, 0)

      const sortedBlocks = data.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      
      let activeBlock = null;
      for (let i = sortedBlocks.length - 1; i >= 0; i--) {
        const blockDate = new Date(sortedBlocks[i].start_date)
        blockDate.setHours(0, 0, 0, 0)
        if (targetDate >= blockDate) {
          activeBlock = sortedBlocks[i];
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
    }

    calculateCurrentWeek()
  }, [dateActive, vueActive, session])

  if (loadingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <RefreshCw className="size-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-sm p-8 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-blue-500/10 text-blue-500 rounded-full mb-4 ring-1 ring-blue-500/20">
              <Lock className="size-8" />
            </div>
            <h1 className="text-2xl font-black text-white">Accès Réservé</h1>
            <p className="text-sm text-slate-500 mt-1">Saisis tes identifiants</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg text-center">
                {authError}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <User className="size-3" /> Identifiant
              </label>
              <input 
                type="text" 
                placeholder="Ex: 1"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-blue-500 transition-colors placeholder:text-slate-700"
                required 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="size-3" /> Mot de passe
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-blue-500 transition-colors"
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full py-4 mt-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex justify-center items-center gap-2"
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
      <Header />

      <div className="mx-auto max-w-5xl px-4 pt-4 flex justify-between items-center relative z-50">
        
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-muted-foreground capitalize">
            {/* ICI : Le titre s'adapte au mode ! */}
            {vueActive === 'accueil' && (isRestDayMode ? "Jour de Repos" : "Séance & Calendrier")}
            {vueActive === 'analytique' && "Tableau de bord"}
            {vueActive === 'outils' && "Outils & Échauffement"}
            {vueActive === 'calculatrice' && "Calculateur de force"}
            {vueActive === 'configuration' && "Configuration des Blocs"}
          </h2>
          <span className="text-xs font-bold text-blue-500 mt-1">{blockInfo}</span>
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
                
                <div className="h-px bg-border my-1"></div>
                
                <button onClick={() => changerVue('configuration')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'configuration' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Settings className="size-4" /> Configuration</button>
                
                <div className="h-px bg-border my-1"></div>
                
                <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors hover:bg-red-500/10 text-red-400 font-medium">
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
            <GLCalculator />
          </div>
        )}

        {vueActive === 'accueil' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <WeekCalendar 
              dateActive={dateActive} 
              setDateActive={setDateActive} 
              blockTitle={blockInfo} 
              isRestDayMode={isRestDayMode} /* On passe l'info au calendrier */
            />
            <SessionForm 
              dateActive={dateActive} 
              isRestDayMode={isRestDayMode} /* On passe l'info au formulaire */
              setIsRestDayMode={setIsRestDayMode} 
            />
          </div>
        )}

        {vueActive === 'analytique' && (
          <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StatsCards pasDuJour={pasDuJour} />
            <Card>
              <CardTitle icon={LineChart} title="Dashboard analytique" hint="RPE · Fatigue · Sommeil" />
              <AnalyticsChart />
            </Card>
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