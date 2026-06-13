'use client'

import { useState } from 'react'
import { Calculator, Scale, Hash, Battery, Info } from 'lucide-react'

export default function CalculatorPanel() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('') 

  const calculate1RM = () => {
    const w = parseFloat(weight)
    const r = parseInt(reps)
    const rpeVal = parseFloat(rpe) || 10

    if (!w || !r || w <= 0 || r <= 0) return { epley: 0, brzycki: 0, avg: 0 }

    const rir = 10 - rpeVal
    const effectiveReps = r + rir

    if (effectiveReps === 1) return { epley: w, brzycki: w, avg: w }

    const epley = w * (1 + (effectiveReps / 30))
    const brzycki = w * (36 / (37 - effectiveReps))
    const avg = (epley + brzycki) / 2

    return {
      epley: epley.toFixed(1),
      brzycki: brzycki.toFixed(1),
      avg: avg.toFixed(1)
    }
  }

  const result = calculate1RM()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Calculator className="size-5 text-blue-500" /> Calculateur de 1RM
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-5">
          
          {/* Les 3 cases d'entrée */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Scale className="size-3 text-blue-500" /> Poids
              </label>
              <input
                type="number"
                placeholder="Ex: 300"
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
          <p className="text-[10px] text-slate-500 text-center italic">Laissez le RPE vide pour un effort à l'échec total (RPE 10).</p>
        </div>

        {/* Affichage des Résultats */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-center relative overflow-hidden">
          
          <div className="space-y-4 relative z-10 w-full">
            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
              <span className="text-sm font-medium text-slate-400">Epley</span>
              <span className="text-lg font-bold text-white">{result.avg !== '0.0' ? result.epley : '—'} kg</span>
            </div>
            
            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
              <span className="text-sm font-medium text-slate-400">Brzycki</span>
              <span className="text-lg font-bold text-white">{result.avg !== '0.0' ? result.brzycki : '—'} kg</span>
            </div>

            <div className="flex justify-between items-center bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
              <span className="text-sm font-black text-blue-400 uppercase tracking-wider">Moyenne</span>
              <span className="text-2xl font-black text-white">{result.avg !== '0.0' ? result.avg : '—'} kg</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 mt-4 relative z-10 flex items-start gap-1.5">
            <Info className="size-3 text-blue-500 shrink-0 mt-0.5" />
            Le tableau de bord estime aussi vos 1RM automatiquement depuis vos meilleures séries.
          </p>
        </div>
      </div>
    </div>
  )
}