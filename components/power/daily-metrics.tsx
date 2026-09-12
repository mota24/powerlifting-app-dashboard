'use client'

import { useT } from '@/app/ThemeContext'
import { safeFloat, safeInt } from '@/lib/seance'

export function DailyMetrics({ fatigue, sommeil, pas, setFatigue, setSommeil, setPas }: { fatigue: number; sommeil: number; pas: number; setFatigue: (v: number) => void; setSommeil: (v: number) => void; setPas: (v: number) => void; }) {
  const t = useT()
  return (
    <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 ml-1">{t('fatigue')}</span>
          <div className="flex items-center gap-4 bg-secondary p-4 rounded-xl border border-border">
            <input type="range" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(safeInt(e.target.value, 5))} className="w-full accent-primary" />
            <span className="text-xl font-black text-foreground tabular-nums">{fatigue}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 ml-1">{t('sommeil')}</span>
          <div className="bg-secondary p-4 rounded-xl border border-border">
            <input type="number" step="0.5" inputMode="decimal" value={sommeil} onChange={(e) => setSommeil(safeFloat(e.target.value))} className="w-full bg-transparent text-xl font-black tabular-nums text-foreground outline-none" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 ml-1">{t('pas')}</span>
          <div className="bg-secondary p-4 rounded-xl border border-border">
            <input type="number" inputMode="decimal" value={pas} onChange={(e) => setPas(safeInt(e.target.value))} className="w-full bg-transparent text-xl font-black tabular-nums text-foreground outline-none" />
          </div>
        </div>
      </div>
    </div>
  )
}
