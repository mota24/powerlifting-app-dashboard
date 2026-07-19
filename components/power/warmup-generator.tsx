'use client'

import { useState } from 'react'
import { Flame } from 'lucide-react'
import { generateWarmup } from '../../lib/powerlifting'

export function WarmupGenerator() {
  const [topSet, setTopSet] = useState(180)
  const steps = generateWarmup(topSet)

  return (
    <div className="p-6 sm:p-8 bg-zinc-950 border border-zinc-900 rounded-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Flame className="size-5 text-white" />
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Échauffement</h2>
      </div>

      <label className="mb-6 block">
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">Top Set (kg)</span>
        <input type="number" step={2.5} inputMode="decimal" value={topSet} onChange={(e) => setTopSet(Number(e.target.value) || 0)} className="w-full rounded-xl bg-zinc-900 px-4 py-4 font-black text-2xl text-white outline-none focus:ring-2 focus:ring-zinc-700 tabular-nums transition-all" />
      </label>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-4 rounded-xl bg-zinc-900 px-4 py-3">
            <span className="flex size-6 items-center justify-center rounded-full bg-black font-black text-[10px] text-white shrink-0">{i + 1}</span>
            <div className="flex-1 flex items-baseline gap-2">
              <span className="font-black text-lg tabular-nums text-white">{s.weight}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{s.label}</span>
            </div>
            <span className="font-black tabular-nums text-sm text-white">×{s.reps}</span>
            <span className="w-12 text-right font-black text-[10px] text-zinc-500">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}