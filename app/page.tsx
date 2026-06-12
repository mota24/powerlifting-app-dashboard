'use client'

import { useState } from 'react'
import { Header } from '@/components/power/header'
import { StatsCards } from '@/components/power/stats-cards'
import { AnalyticsChart } from '@/components/power/analytics-chart'
import { WeekCalendar } from '@/components/power/week-calendar'
import { SessionForm } from '@/components/power/session-form'
import { PlateVisualizer } from '@/components/power/plate-visualizer'
import { WarmupGenerator } from '@/components/power/warmup-generator'
import { Card, CardTitle } from '@/components/power/card'
import { LineChart, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Page() {
  const [peaking, setPeaking] = useState(false)

  return (
    <div className="min-h-dvh bg-background pb-16">
      <Header peaking={peaking} onTogglePeaking={() => setPeaking((p) => !p)} />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Dashboard analytique */}
        <section className="space-y-3">
          <StatsCards />
          <Card className={cn(peaking && 'border-primary/50')}>
            <CardTitle
              icon={LineChart}
              title="Dashboard analytique"
              hint="RPE · Fatigue · Sensations — 7 dernières semaines"
            />
            {peaking ? (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                <Flame className="size-3.5" />
                Mode Peaking actif : surveillez la fatigue, l&apos;intensité prime
                sur le volume.
              </div>
            ) : null}
            <AnalyticsChart />
          </Card>
        </section>

        <WeekCalendar />

        {/* Coeur de l'app + outils */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SessionForm />
          <div className="space-y-6">
            <PlateVisualizer />
            <WarmupGenerator />
          </div>
        </div>
      </main>
    </div>
  )
}
