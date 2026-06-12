'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase' 
import { Header } from '@/components/power/header'
import { StatsCards } from '@/components/power/stats-cards'
import { AnalyticsChart } from '@/components/power/analytics-chart'
import { WeekCalendar } from '@/components/power/week-calendar'
import SessionForm from '@/components/power/session-form'
import { PlateVisualizer } from '@/components/power/plate-visualizer'
import { WarmupGenerator } from '@/components/power/warmup-generator'
import { Card, CardTitle } from '@/components/power/card'
import { LineChart, Menu, X, Home, BarChart2, Wrench, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfigPanel from '@/components/power/config-panel'

export default function Page() {
  const [vueActive, setVueActive] = useState('accueil')
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [dateActive, setDateActive] = useState<Date>(new Date())
  
  const [showConfig, setShowConfig] = useState(false)
  const [blockInfo, setBlockInfo] = useState('Chargement...')

  const changerVue = (vue: string) => {
    setVueActive(vue)
    setMenuOuvert(false)
    setShowConfig(false) 
  }

  // ALGORITHME DE CALCUL DES SEMAINES
  useEffect(() => {
    const calculateCurrentWeek = async () => {
      const { data } = await supabase
        .from('training_blocks')
        .select('*')
        .order('block_number', { ascending: true })

      if (!data || data.length === 0) {
        setBlockInfo('Aucun bloc planifié')
        return
      }

      // Calcul par rapport au jour sélectionné dans le calendrier
      const targetDate = new Date(dateActive)
      targetDate.setHours(0, 0, 0, 0)

      // On trie les blocs par date pour trouver le plus récent qui a déjà commencé
      const sortedBlocks = data.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      
      let activeBlock = null;
      for (let i = sortedBlocks.length - 1; i >= 0; i--) {
        const blockDate = new Date(sortedBlocks[i].start_date)
        blockDate.setHours(0, 0, 0, 0)
        if (targetDate >= blockDate) {
          activeBlock = sortedBlocks[i];
          break; // On a trouvé le bloc en cours !
        }
      }

      if (activeBlock) {
        const startDate = new Date(activeBlock.start_date)
        startDate.setHours(0, 0, 0, 0)
        
        // On récupère la durée enregistrée (par défaut 5 si non trouvée)
        const duration = activeBlock.duration_weeks || 5
        
        // Calcul mathématique des semaines
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
  }, [dateActive, showConfig]) // Le texte se met à jour quand on change de date !

  return (
    <div className="min-h-dvh bg-background pb-16 relative">
      <Header />

      <div className="mx-auto max-w-5xl px-4 pt-4 flex justify-between items-center relative z-50">
        
        {/* AFFICHAGE DU BLOC EN COURS */}
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-muted-foreground capitalize">
            {vueActive === 'accueil' && "Séance & Calendrier"}
            {vueActive === 'analytique' && "Tableau de bord"}
            {vueActive === 'outils' && "Outils & Échauffement"}
          </h2>
          {/* L'algorithme affiche le résultat ici */}
          <span className="text-xs font-bold text-blue-500 mt-1">{blockInfo}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* BOUTON CONFIGURATION */}
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className={cn("flex items-center justify-center p-2 rounded-md transition-colors", showConfig ? "bg-blue-500/20 text-blue-400" : "bg-secondary/50 hover:bg-secondary text-foreground")}
            title="Configuration des Blocs"
          >
            <Settings className="size-5" />
          </button>

          {/* MENU PRINCIPAL */}
          <div className="relative">
            <button onClick={() => setMenuOuvert(!menuOuvert)} className="flex items-center justify-center p-2 rounded-md bg-secondary/50 hover:bg-secondary border border-border transition-colors">
              {menuOuvert ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            {menuOuvert && (
              <div className="absolute top-12 right-0 w-56 bg-card border border-border p-2 rounded-lg shadow-xl flex flex-col gap-1 z-50">
                <button onClick={() => changerVue('accueil')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'accueil' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Home className="size-4" /> Accueil</button>
                <button onClick={() => changerVue('analytique')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'analytique' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><BarChart2 className="size-4" /> Analytique</button>
                <button onClick={() => changerVue('outils')} className={cn("flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors", vueActive === 'outils' ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground")}><Wrench className="size-4" /> Outils</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-4">
        {/* SI LE PANNEAU CONFIG EST OUVERT, ON L'AFFICHE À LA PLACE DU RESTE */}
        {showConfig ? (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <ConfigPanel />
          </div>
        ) : (
          /* SINON, ON AFFICHE LA VUE NORMALE (Accueil, Analytique, etc.) */
          <>
            {vueActive === 'accueil' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* TRANSMISSION DU TEXTE AU CALENDRIER */}
                <WeekCalendar dateActive={dateActive} setDateActive={setDateActive} blockTitle={blockInfo} />
                <SessionForm dateActive={dateActive} />
              </div>
            )}

            {vueActive === 'analytique' && (
              <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatsCards />
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
          </>
        )}
      </main>
    </div>
  )
}