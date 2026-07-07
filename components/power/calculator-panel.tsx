'use client'

import { useState } from 'react'
import { Calculator, Scale, Hash, Battery, Dumbbell } from 'lucide-react'
import { averageE1RM, roundToLoadable } from '@/lib/powerlifting'

const WORK_PERCENTAGES = [0.9, 0.85, 0.8] as const

export default function CalculatorPanel() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('') // Vide par défaut

  const w = parseFloat(weight)
  const r = parseInt(reps, 10)
  // Si la case RPE est vide, on prend 10 par défaut (échec total)
  const rpeVal = parseFloat(rpe)

  const e1rm = averageE1RM(w, r, Number.isFinite(rpeVal) ? rpeVal : 10)
  const result1RM = e1rm > 0 ? e1rm.toFixed(1) : null

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Calculator className="size-5 text-blue-500" /> Calculateur de 1RM
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Panneau des entrées (Poids, Reps, RPE) */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-center space-y-5">
          
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Scale className="size-3 text-blue-500" /> Poids
              </label>
              <input
                type="number"
                placeholder="Ex: 220"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-blue-500 placeholder:text-slate-700 text-center"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Hash className="size-3 text-blue-500" /> Reps
              </label>
              <input
                type="number"
                placeholder="Ex: 5"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-blue-500 placeholder:text-slate-700 text-center"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Battery className="size-3 text-red-500" /> RPE
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="Vide=10"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold outline-none focus:border-red-500 placeholder:text-slate-700 text-center"
              />
            </div>
          </div>
          
          <p className="text-[10px] text-slate-500 text-center italic">
            Laissez le RPE vide pour un effort à l'échec total (RPE 10).
          </p>
        </div>

        {/* Affichage du Résultat (Le beau design bleu avec la calculatrice de fond) */}
        <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[160px]">
          <div className="absolute -right-6 -bottom-6 opacity-5">
            <Calculator className="size-40 text-blue-500" />
          </div>

          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 relative z-10">
            PR THÉORIQUE
          </span>
          
          <div className="text-5xl font-black text-white relative z-10 tracking-tight">
            {result1RM ?? '—'}{' '}
            <span className="text-xl font-medium text-slate-500">kg</span>
          </div>

          <p className="text-xs text-slate-500 mt-3 max-w-[240px] relative z-10">
            Calcul basé sur la moyenne Epley/Brzycki.
          </p>

          {/* Charges de travail réellement chargeables (pas de 2.5 kg) */}
          {e1rm > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4 relative z-10">
              {WORK_PERCENTAGES.map((pct) => (
                <span key={pct} className="flex items-center gap-1.5 rounded-md bg-slate-950/80 border border-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">
                  <Dumbbell className="size-3 text-blue-500" />
                  {Math.round(pct * 100)}% → {roundToLoadable(e1rm * pct)} kg
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
