'use client'

import { useState } from 'react'
import { Header } from '@/components/power/header'
import { StatsCards } from '@/components/power/stats-cards'
import { AnalyticsChart } from '@/components/power/analytics-chart'
import { WeekCalendar } from '@/components/power/week-calendar'
import SessionForm from '@/components/power/session-form' // Sans accolades !
import { PlateVisualizer } from '@/components/power/plate-visualizer'
import { WarmupGenerator } from '@/components/power/warmup-generator'
import { Card, CardTitle } from '@/components/power/card'
import { LineChart, Flame, Menu, X, Home, BarChart2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Page() {
  const [peaking, setPeaking] = useState(false)
  const [vueActive, setVueActive] = useState('accueil')
  const [menuOuvert, setMenuOuvert] = useState(false)
  
  // LE CERVEAU CENTRAL : Garde en mémoire la date cliquée dans le calendrier
  const [dateActive, setDateActive] = useState<Date>(new Date())

  const changerVue = (vue: string) => {
    setVueActive(vue)
    setMenuOuvert(false)
  }

  return (
    <div className="min-h-dvh bg-background pb-16 relative">
      <Header peaking={peaking} onTogglePeaking={() => setPeaking((p) => !p)} />

      <div className="mx-auto max-w-5xl px-4 pt-4 flex justify-between items-center relative z-50">
        <h2 className="text-sm font-medium text-muted-foreground capitalize">
          {vueActive === 'accueil' && "Séance & Calendrier"}
          {vueActive === 'analytique' && "Tableau de bord"}
          {vueActive === 'outils' && "Outils & Échauffement"}
        </h2>

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

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-4">
        {vueActive === 'accueil' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* On branche le calendrier et le formulaire au cerveau */}
            <WeekCalendar dateActive={dateActive} setDateActive={setDateActive} />
            <SessionForm dateActive={dateActive} />
          </div>
        )}

        {vueActive === 'analytique' && (
          <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StatsCards />
            <Card className={cn(peaking && 'border-primary/50')}>
              <CardTitle icon={LineChart} title="Dashboard analytique" hint="RPE · Fatigue · Sensations — 7 dernières semaines" />
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