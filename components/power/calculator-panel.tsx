'use client'

import { useState } from 'react'
import { Calculator, Scale, Hash, Battery, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CalculatorPanel() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('') // Vide par défaut
  const [lift, setLift] = useState<'squat' | 'bench' | 'deadlift'>('squat')

  const calculateExact1RM = () => {
    const w = parseFloat(weight)
    const r = parseInt(reps)
    
    // MAGIE ICI : Si rpe est vide (''), parseFloat(rpe) renvoie NaN, donc ça prend 10 par défaut.
    const rpeVal = parseFloat(rpe) || 10

    if (!w || !r || w <= 0 || r <= 0) return 0

    const rir = 10 - rpeVal
    const effectiveReps = r + rir
    
    let result = 0

    if (lift === 'squat') {
      result = w * (1 + (effectiveReps * 0.03372))
    } else if (lift === 'bench') {
      result = w * (1 + (effectiveReps * 0.0250))
    } else if (lift === 'deadlift') {
      result = w * (1 + (effectiveReps * 0.0428))
    }
    
    return Math.floor(result)
  }

  const result1RM = calculateExact1RM()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Calculator className="size-5 text-blue-500" /> Calculateur de 1RM
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-5">
          
          {/* Sélection du mouvement */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Dumbbell className="size-3.5 text-blue-500" /> Mouvement
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setLift('squat')} className={cn("py-2 text-sm font-bold rounded-lg border transition-colors", lift === 'squat' ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-slate-950 border-slate-800 text-slate-500")}>Squat</button>
              <button onClick={() => setLift('bench')} className={cn("py-2 text-sm font-bold rounded-lg border transition-colors", lift === 'bench' ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-slate-950 border-slate-800 text-slate-500")}>Bench</button>
              <button onClick={() => setLift('deadlift')} className={cn("py-2 text-sm font-bold rounded-lg border transition-colors", lift === 'deadlift' ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-slate-950 border-slate-800 text-slate-500")}>Deadlift</button>
            </div>
          </div>

          {/* Les 3 cases d'entrée de données */}
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
          <p className="text-[10px] text-slate-500 text-center italic">Laissez le RPE vide pour un effort à l'échec total (RPE 10).</p>
        </div>

        {/* Affichage du Résultat */}
        <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[160px]">
          <div className="absolute -right-6 -bottom-6 opacity-5">
            <Calculator className="size-40 text-blue-500" />
          </div>

          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 relative z-10">
            PR Théorique ({lift})
          </span>
          
          <div className="text-5xl font-black text-white relative z-10 tracking-tight">
            {result1RM > 0 ? `${result1RM}` : '—'}{' '}
            <span className="text-xl font-medium text-slate-500">kg</span>
          </div>

          <p className="text-xs text-slate-500 mt-3 max-w-[240px] relative z-10">
            Calcul identique au Dashboard (Algorithme Workout Temple).
          </p>
        </div>
      </div>
    </div>
  )
}