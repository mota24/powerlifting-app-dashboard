'use client'

import { useState } from 'react'
import { Calculator, Scale, Hash, Battery, Dumbbell } from 'lucide-react'
import { averageE1RM, roundToLoadable } from '@/lib/powerlifting'

const WORK_PERCENTAGES = [0.9, 0.85, 0.8] as const

export default function CalculatorPanel() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')

  const w = parseFloat(weight)
  const r = parseInt(reps, 10)
  const rpeVal = parseFloat(rpe)

  const e1rm = averageE1RM(w, r, Number.isFinite(rpeVal) ? rpeVal : 10)
  const result1RM = e1rm > 0 ? e1rm.toFixed(1) : null

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="size-5 text-white" />
        <h2 className="text-xs font-bold text-white uppercase tracking-widest">Calculateur de 1RM</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-950 flex flex-col justify-center space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1">
                <Scale className="size-3 text-white" /> Poids
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="220"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white font-black tabular-nums text-xl outline-none focus:border-white placeholder:text-zinc-800 text-center transition-colors"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1">
                <Hash className="size-3 text-white" /> Reps
              </label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="5"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white font-black tabular-nums text-xl outline-none focus:border-white placeholder:text-zinc-800 text-center transition-colors"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1">
                <Battery className="size-3 text-white" /> RPE
              </label>
              <input
                type="number"
                step="0.5"
                inputMode="decimal"
                placeholder="10"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className="w-full p-4 bg-black border border-zinc-800 rounded-xl text-white font-black tabular-nums text-xl outline-none focus:border-white placeholder:text-zinc-800 text-center transition-colors"
              />
            </div>
          </div>
          
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 text-center">
            LAISSEZ RPE VIDE POUR ÉCHEC TOTAL (10)
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-zinc-900 bg-black flex flex-col items-center justify-center text-center min-h-[160px]">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
            PR THÉORIQUE ESTIMÉ
          </span>
          
          <div className="text-6xl font-black text-white tabular-nums tracking-tighter">
            {result1RM ?? '—'}
          </div>

          {e1rm > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {WORK_PERCENTAGES.map((pct) => (
                <span key={pct} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-[10px] font-black text-white tabular-nums tracking-widest">
                  <Dumbbell className="size-3 text-zinc-500 shrink-0" />
                  {Math.round(pct * 100)}% → {roundToLoadable(e1rm * pct)} KG
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}